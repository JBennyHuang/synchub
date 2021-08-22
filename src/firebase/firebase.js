import firebaseConfig from "./firebase_configs"
import firebase from "firebase"

const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app()

export default app
