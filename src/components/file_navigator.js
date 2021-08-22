import { FileOutlined, FolderOutlined } from "@ant-design/icons"
import { Menu } from "antd"
import React from "react"
import { DragDropContext } from "react-beautiful-dnd"

const recursiveDir = (dir, onFileClick) => {
  const files = []

  for (const file of dir) {
    if (file.isDir) {
      files.push(
        <Menu.SubMenu icon={<FolderOutlined />} title={file.name}>
          {recursiveDir(file.dir)}
        </Menu.SubMenu>
      )
    } else {
      files.push(
        <Menu.Item icon={<FileOutlined />}>{file.name}</Menu.Item>
      )
    }
  }

  return files
}

const FileNavigator = ({ dir = [], onFileClick }) => {


  dir = [
    {
      isDir: true,
      name: 'compoenents',
      dir: [
        {
          isDir: false,
          name: 'file_navigator.js',
        },
        {
          isDir: false,
          name: 'loading.js',
        },
      ]
    },
    {
      isDir: false,
      name: 'App.js',
    },
    {
      isDir: false,
      name: 'index.js',
    },
  ]

  return (
    <>
      <DragDropContext>
        <Menu theme="dark" mode="inline" selectable={false}>
          {recursiveDir(dir)}
        </Menu>
      </DragDropContext>
    </>
  )
}

export default FileNavigator
