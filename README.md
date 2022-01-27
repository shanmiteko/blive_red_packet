# 监控直播间红包

```js
getAreaList().then(ids => {
    ids.forEach(id => {
        // 混合子分区 第一页
        getList(id, 0, 1).then(args => {
            args.forEach(async arg => {
                let red_packet_monitor = new RedPacketMonitor(...arg)
                    //默认不进行关注
                    .no_relation_modify();
                if (await red_packet_monitor.start()) {
                    setTimeout(() => {
                        red_packet_monitor.close()
                        //默认只监控5分钟
                    }, 5 * 60 * 1000);
                }
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