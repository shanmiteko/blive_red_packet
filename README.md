# 监控直播间红包

```js
getAreaList().then(ids => {
    ids.forEach(id => {
        // 主分区 混合子分区 第一页
        getList(id, 0, 1).then(args => {
            args.forEach(arg => {
                let red_packet_monitor = new RedPacketMonitor(...arg)
                // 5分钟内未有红包自动断开
                // 出现一次红包计时器累加
                red_packet_monitor.start()
            })
        })
    })
})

```
# 用法

新建文件`cookie.json`填入cookie
```json
{
    "cookie": ""
}
```


```
$ npm install
$ npm start
```