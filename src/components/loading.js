import { LoadingOutlined } from "@ant-design/icons"
import { Spin } from "antd"

const Loading = () => {
  const icon = <LoadingOutlined style={{ fontSize: 48 }} spin />

  return (
    <>
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Spin indicator={icon} />
      </div>
    </>
  )
}

export default Loading