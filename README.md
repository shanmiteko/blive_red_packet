# 监控直播间红包

```js
pipe([
    () => require("./cookie.json")["cookie"],
    parseCookie,
    setGlobal('cookie'),
    getAttentionList,
    setGlobal('attention_list'),
    getAreaList,
    cross(list(2)),
    forEach(apply(
        getList,
        forEach(apply(
            RedPacketMonitor.build,
            red_packet_monitor => red_packet_monitor.no_relation_modify().start()
        ))
    ))
])
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