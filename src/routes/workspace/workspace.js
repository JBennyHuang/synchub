import app from '../../firebase/firebase'
import { Redirect } from 'react-router-dom'
import { Menu, Layout } from 'antd'
import React from 'react'
import { FileOutlined, LogoutOutlined, SearchOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'

import './workspace.css'
import FileNavigator from '../../components/file_navigator'
import Loading from '../../components/loading'
import MonacoEditor from '../../components/monaco_editor'

const Workspace = ({ authContext }) => {
  const [authenticated, setAuthenticated] = React.useState(null)

  React.useEffect(() => {
    app.auth().onAuthStateChanged((user) => {
      if (user) {
        setAuthenticated(true)
      } else {
        setAuthenticated(false)
      }
    })
    return () => { }
  }, [])

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

  const signOut = () => {
    app.auth().signOut().then(() => {
      console.log('signed out')
    }).catch((error) => {
      console.log(error)
    })
  }

  if (authenticated === null) {
    return <><Loading /></>
  } else {
    if (authenticated) {
      return (
        <>
          <Layout style={{ height: "100vh" }} >
            <Layout.Sider trigger={null} width={60}>
              <Menu theme="dark" mode="inline" selectedKeys={selected}>
                <Menu.Item key="1" icon={<FileOutlined />} onClick={selectHandle} />
                <Menu.Item key="2" icon={<SearchOutlined />} onClick={selectHandle} />
              </Menu>
              <Menu theme="dark" mode="inline" selectable={false} style={{ position: "absolute", bottom: "0px" }} >
                <Menu.Item icon={<UserOutlined />} />
                <Menu.Item icon={<SettingOutlined />} />
                <Menu.Item icon={<LogoutOutlined />} onClick={signOut} />
              </Menu>
            </Layout.Sider>
            <Layout.Sider trigger={null} collapsible collapsed={collapsed} width={400} collapsedWidth={0}>
              <FileNavigator>

              </FileNavigator>
            </Layout.Sider>
            <Layout className="site-layout">
              <Layout.Content
                className="site-layout-background"
                style={{
                  margin: '16px'
                }}
              >
                <MonacoEditor />
              </Layout.Content>
            </Layout>
          </Layout>
        </>
      )
    } else {
      return (
        <>
          <Redirect to="/signin"></Redirect>
        </>
      )
    }
  }
}

export default Workspace