import "firebase/firestore";
import firebase from "firebase/app";
import { DatabaseAdapterEvent as FirestoreAdapterEvent, } from "@hackerrank/firepad/es/database-adapter";
import { EventEmitter } from "@hackerrank/firepad/es/editor-client";
import { TextOperation } from "@hackerrank/firepad/es/text-operation";
import * as Utils from "@hackerrank/firepad/es/utils";
const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
class FirestoreAdapter {
  constructor(databaseRef, userId, userColor, userName) {
    if (typeof databaseRef !== "object") {
      databaseRef = firebase.database().ref(databaseRef);
    }
    this._databaseRef = databaseRef;
    this._ready = false;
    this._firebaseCallbacks = [];
    this._zombie = false;
    this._initialRevisions = false;
    this.setUserId(userId);
    this.setUserColor(userColor);
    this.setUserName(userName);
    this._document = new TextOperation();
    this._revision = 0;
    this._pendingReceivedRevisions = {};
    this._emitter = new EventEmitter([
      FirestoreAdapterEvent.Acknowledge,
      FirestoreAdapterEvent.CursorChange,
      FirestoreAdapterEvent.Error,
      FirestoreAdapterEvent.Operation,
      FirestoreAdapterEvent.Ready,
      FirestoreAdapterEvent.Retry,
      FirestoreAdapterEvent.InitialRevision,
    ]);
    this._init();
  }
  _init() {
    const connectedRef = this._databaseRef.root.child(".info/connected");
    this._firebaseOn(connectedRef, "value", (snapshot) => {
      if (snapshot.val() === true) {
        this._initializeUserData();
      }
    });
    this.on(FirestoreAdapterEvent.Ready, () => {
      this._monitorCursors();
    });
    setTimeout(() => {
      this._monitorHistory();
    }, 1);
  }
  dispose() {
    if (!this._ready) {
      this.on(FirestoreAdapterEvent.Ready, () => {
        this.dispose();
      });
      return;
    }
    if (this._emitter) {
      this._emitter.dispose();
      this._emitter = null;
    }
    this._removeFirebaseCallbacks();
    this._databaseRef = null;
    this._userRef = null;
    this._document = null;
    this._zombie = true;
  }
  getDocument() {
    return this._document;
  }
  isCurrentUser(clientId) {
    return this._userId == clientId;
  }
  on(event, listener) {
    var _a;
    return (_a = this._emitter) === null || _a === void 0 ? void 0 : _a.on(event, listener);
  }
  off(event, listener) {
    var _a;
    return (_a = this._emitter) === null || _a === void 0 ? void 0 : _a.off(event, listener);
  }
  registerCallbacks(callbacks) {
    Object.entries(callbacks).forEach(([event, listener]) => {
      this.on(event, listener);
    });
  }
  _trigger(event, eventArgs, ...extraArgs) {
    var _a;
    return (_a = this._emitter) === null || _a === void 0 ? void 0 : _a.trigger(event, eventArgs || {}, ...extraArgs);
  }
  _initializeUserData() {
    this._userRef.child("cursor").onDisconnect().remove();
    this._userRef.child("color").onDisconnect().remove();
    this._userRef.child("name").onDisconnect().remove();
    this.sendCursor(this._userCursor || null);
  }
  _monitorHistory() {
    this._databaseRef.child("checkpoint").once("value", (snapshot) => {
      if (this._zombie) {
        return;
      }
      const revisionId = snapshot.child("id").val();
      const op = snapshot.child("o").val();
      const author = snapshot.child("a").val();
      if (op != null && revisionId != null && author !== null) {
        this._pendingReceivedRevisions[revisionId] = { o: op, a: author };
        this._checkpointRevision = this._revisionFromId(revisionId);
        this._monitorHistoryStartingAt(this._checkpointRevision + 1);
      }
      else {
        this._checkpointRevision = 0;
        this._monitorHistoryStartingAt(this._checkpointRevision);
      }
    });
  }
  _historyChildAdded(revisionSnapshot) {
    const revisionId = revisionSnapshot.key;
    this._pendingReceivedRevisions[revisionId] = revisionSnapshot.val();
    if (this._ready) {
      this._handlePendingReceivedRevisions();
    }
  }
  _monitorHistoryStartingAt(revision) {
    const historyRef = this._databaseRef.child("history").startAt(null, this._revisionToId(revision));
    this._firebaseOn(historyRef, "child_added", this._historyChildAdded, this);
    historyRef.once("value", () => {
      this._handleInitialRevisions();
    });
  }
  _handleInitialRevisions() {
    if (this._zombie) {
      return;
    }
    Utils.validateFalse(this._ready, "Should not be called multiple times.");
    if (!this._initialRevisions) {
      this._initialRevisions = true;
      this._trigger(FirestoreAdapterEvent.InitialRevision);
    }
    this._revision = this._checkpointRevision;
    let revisionId = this._revisionToId(this._revision);
    const pending = this._pendingReceivedRevisions;
    while (pending[revisionId] != null) {
      const revision = this._parseRevision(pending[revisionId]);
      if (!revision) {
        console.log("Invalid operation.", this._userRef.toString(), revisionId, pending[revisionId]);
      }
      else {
        this._document = this._document.compose(revision.operation);
      }
      delete pending[revisionId];
      this._revision++;
      revisionId = this._revisionToId(this._revision);
    }
    this._trigger(FirestoreAdapterEvent.Operation, this._document);
    this._ready = true;
    setTimeout(() => {
      this._trigger(FirestoreAdapterEvent.Ready, true);
    });
  }
  _handlePendingReceivedRevisions() {
    const pending = this._pendingReceivedRevisions;
    let revisionId = this._revisionToId(this._revision);
    let triggerRetry = false;
    while (pending[revisionId] != null) {
      this._revision++;
      const revision = this._parseRevision(pending[revisionId]);
      if (!revision) {
        console.log("Invalid operation.", this._databaseRef.toString(), revisionId, pending[revisionId]);
      }
      else {
        this._document = this._document.compose(revision.operation);
        if (this._sent && revisionId === this._sent.id) {
          if (this._sent.op.equals(revision.operation) &&
            revision.author == this._userId) {
            if (this._revision % FirestoreAdapter.CHECKPOINT_FREQUENCY === 0) {
              this._saveCheckpoint();
            }
            this._sent = null;
            this._trigger(FirestoreAdapterEvent.Acknowledge);
          }
          else {
            triggerRetry = true;
            this._trigger(FirestoreAdapterEvent.Operation, revision.operation);
          }
        }
        else {
          this._trigger(FirestoreAdapterEvent.Operation, revision.operation);
        }
      }
      delete pending[revisionId];
      revisionId = this._revisionToId(this._revision);
    }
    if (triggerRetry) {
      this._sent = null;
      this._trigger(FirestoreAdapterEvent.Retry);
    }
  }
  sendOperation(operation, callback = Utils.noop) {
    if (!this._ready) {
      this.on(FirestoreAdapterEvent.Ready, () => {
        this._trigger(FirestoreAdapterEvent.Retry);
      });
      return;
    }
    if (!this._document.canMergeWith(operation)) {
      const error = "sendOperation() called with invalid operation.";
      this._trigger(FirestoreAdapterEvent.Error, error, operation.toString(), {
        operation: operation.toString(),
        document: this._document.toString(),
      });
      Utils.onInvalidOperationRecieve(error);
    }
    const revisionId = this._revisionToId(this._revision);
    this._sent = { id: revisionId, op: operation };
    const revisionData = {
      a: this._userId,
      o: operation.toJSON(),
      t: firebase.database.ServerValue.TIMESTAMP,
    };
    this._doTransaction(revisionId, revisionData, callback);
  }
  _doTransaction(revisionId, revisionData, callback) {
    this._databaseRef.child("history")
      .child(revisionId)
      .transaction((current) => {
        if (current === null) {
          return revisionData;
        }
      }, (error, committed) => {
        if (error) {
          if (error.message === "disconnect") {
            if (this._sent && this._sent.id === revisionId) {
              setTimeout(() => {
                this._doTransaction(revisionId, revisionData, callback);
              });
            }
            return callback(error, false);
          }
          else {
            this._trigger(FirestoreAdapterEvent.Error, error, revisionData.o.toString(), {
              operation: revisionData.o.toString(),
              document: this._document.toString(),
            });
            Utils.onFailedDatabaseTransaction(error.message);
          }
        }
        return callback(null, committed);
      }, false);
  }
  _parseRevision(data) {
    if (typeof data !== "object" || typeof data.o !== "object") {
      return null;
    }
    let op = null;
    try {
      op = TextOperation.fromJSON(data.o);
    }
    catch (e) {
      return null;
    }
    if (!this._document.canMergeWith(op)) {
      return null;
    }
    return {
      author: data.a,
      operation: op,
    };
  }
  _saveCheckpoint() {
    this._databaseRef.child("checkpoint").set({
      a: this._userId,
      o: this._document.toJSON(),
      id: this._revisionToId(this._revision - 1),
    });
  }
  isHistoryEmpty() {
    Utils.validateTruth(this._ready, "Not ready yet.");
    return this._revision === 0;
  }
  setUserId(userId) {
    Utils.validateTruth(typeof userId === "string" || typeof userId === "number", "User ID must be either String or Integer.");
    if (this._userRef) {
      this._userRef.child("cursor").remove();
      this._userRef.child("cursor").onDisconnect().cancel();
      this._userRef.child("color").remove();
      this._userRef.child("color").onDisconnect().cancel();
      this._userRef = null;
    }
    this._userId = userId;
    this._userRef = this._databaseRef.child("users").child(userId.toString());
    this._initializeUserData();
  }
  setUserColor(userColor) {
    Utils.validateTruth(typeof userColor === "string", "User Color must be String.");
    if (!this._userRef) {
      return;
    }
    this._userRef.child("color").set(userColor);
    this._userColor = userColor;
  }
  setUserName(userName) {
    Utils.validateTruth(typeof userName === "string", "User Name must be String.");
    if (!this._userRef) {
      return;
    }
    this._userRef.child("name").set(userName);
    this._userName = userName;
  }
  sendCursor(cursor, callback = Utils.noop) {
    if (!this._userRef) {
      return;
    }
    const cursorData = cursor != null ? cursor.toJSON() : null;
    this._userRef.child("cursor").set(cursorData, function (error) {
      if (typeof callback === "function") {
        callback(error, cursor);
      }
    });
    this._userCursor = cursor;
  }
  _childChanged(childSnap) {
    if (this._zombie) {
      return;
    }
    const userId = childSnap.key;
    const userData = childSnap.val();
    this._trigger(FirestoreAdapterEvent.CursorChange, userId, userData.cursor, userData.color, userData.name);
  }
  _childRemoved(childSnap) {
    const userId = childSnap.key;
    this._trigger(FirestoreAdapterEvent.CursorChange, userId, null);
  }
  _monitorCursors() {
    const usersRef = this._databaseRef.child("users");
    this._firebaseOn(usersRef, "child_added", this._childChanged, this);
    this._firebaseOn(usersRef, "child_changed", this._childChanged, this);
    this._firebaseOn(usersRef, "child_removed", this._childRemoved, this);
  }
  _firebaseOn(ref, eventType, callback, context) {
    this._firebaseCallbacks.push({
      ref,
      eventType,
      callback,
      context,
    });
    ref.on(eventType, callback, context);
  }
  _removeFirebaseCallbacks() {
    for (const callbackRef of this._firebaseCallbacks) {
      const { ref, eventType, callback, context } = callbackRef;
      ref.off(eventType, callback, context);
    }
    this._firebaseCallbacks = [];
  }
  _revisionToId(revision) {
    if (revision === 0) {
      return "A0";
    }
    let str = "";
    while (revision > 0) {
      const digit = revision % characters.length;
      str = characters[digit] + str;
      revision -= digit;
      revision /= characters.length;
    }
    const prefix = characters[str.length + 9];
    return `${prefix}${str}`;
  }
  _revisionFromId(revisionId) {
    Utils.validateTruth(revisionId.length > 0 &&
      revisionId[0] === characters[revisionId.length + 8]);
    let revision = 0;
    for (let i = 1; i < revisionId.length; i++) {
      revision *= characters.length;
      revision += characters.indexOf(revisionId[i]);
    }
    return revision;
  }
}
FirestoreAdapter.CHECKPOINT_FREQUENCY = 100;

export default FirestoreAdapter