import React from "react";
import * as monaco from "monaco-editor"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco"

const MonacoEditor = () => {
  const editorRef = React.useRef()

  React.useEffect(() => {
    const editor = monaco.editor.create(editorRef.current, {
      value: "", language: 'javascript', automaticLayout: true
    })
    const yDoc = new Y.Doc()

    const type = yDoc.getText('monaco')
    const provider = new WebsocketProvider('ws://localhost:1234', 'test', yDoc)
    const monacoBinding = new MonacoBinding(type, editor.getModel(), new Set([editor]), provider.awareness)

    return () => {
      editor.dispose()
      yDoc.destroy()
      provider.destroy()
      monacoBinding.destroy()
    }
  }, [])

  return (
    <div ref={editorRef} style={{ height: "calc(100vh - 44px)" }} />
  )
}

export default MonacoEditor