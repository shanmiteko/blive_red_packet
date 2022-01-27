# 监控直播间红包

```js
// 获取关注列表
getAttentionList().then(alists => {
    attention_list = alists
    // 获取直播分区
    getAreaList().then(ids => {
        ids.forEach(id => {
            // 获取直播房间: 主分区 混合子分区 第一页
            getList(id, 0, 1).then(args => {
                args.forEach(arg => {
                    // 5分钟内未有红包自动断开
                    // 出现一次红包计时器累加
                    let red_packet_monitor = new RedPacketMonitor(...arg)
                    red_packet_monitor.start()
                })
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