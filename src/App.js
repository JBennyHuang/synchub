import React from 'react';
import * as monaco from "monaco-editor"
import firebaseConfig from './firebase_configs';
import firebase from 'firebase';
import { fromMonaco } from "@hackerrank/firepad";

import { Layout, Menu } from 'antd';
import {
  FileOutlined,
  SearchOutlined
} from '@ant-design/icons';

import './App.css'

const { Header, Sider, Content } = Layout;



const MonacoEditor = () => {
  const editorRef = React.useRef()
  const [editor, setEditor] = React.useState(null)
  const [firepad, setFirepad] = React.useState(null)

  React.useEffect(() => {
    if (editor === null) {
      setEditor(monaco.editor.create(editorRef.current, {
        value: "print('Hello World!')\nprint('Hello World!')\nprint('Hello World!')", language: "python", automaticLayout: true
      }))


    } else if (editor && firepad === null) {
      const db = firebase.database().ref().child('test')

      setFirepad(fromMonaco(db, editor))
    } else {
      const name = prompt("Enter your name:")

      firepad.setUserName(name)

      return () => { if (editor) editor.dispose(); if (firepad) firepad.dispose() }
    }
  }, [editor, firepad])

  return (
    <div ref={editorRef} style={{ height: "100%" }} />
  )
}

function App() {
  React.useEffect(() => {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    } else {
      firebase.app();
    }
  })

  const [selected, setSelected] = React.useState("1")
  const [collapsed, setCollapsed] = React.useState(false)

  const selectHandle = ({ key }) => {
    if (collapsed) {
      setSelected(key)
      setCollapsed(false)
    } else {
      if (key === selected) {
        setSelected(null)
        setCollapsed(true)
      } else {
        setSelected(key)
      }

    }
  }


  return (
    <Layout style={{ height: "100vh" }} >
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div className="logo" />
        <Menu theme="dark" mode="inline" selectedKeys={selected}>
          <Menu.Item key="1" icon={<FileOutlined />} onClick={selectHandle}>
            nav 1
          </Menu.Item>
          <Menu.Item key="2" icon={<SearchOutlined />} onClick={selectHandle}>
            nav 2
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout className="site-layout">
        <Content
          className="site-layout-background"
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
          }}
        >
          <MonacoEditor></MonacoEditor>
        </Content>
      </Layout>
    </ Layout>
  );
}

export default App;
