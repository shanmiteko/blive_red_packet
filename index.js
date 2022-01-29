const { stringify } = require('querystring');
const fetch = require("node-fetch");
const { LiveFlow } = require("bili-live-comment-ws");
const cookie_str = require("./cookie.json")["cookie"];

/**
 * @param {number} source_id
 * @returns {Promise<number[]>}
 */
async function getAreaList(source_id = 1) {
    const resp = await fetch(`https://api.live.bilibili.com/xlive/web-interface/v1/index/getWebAreaList?source_id=${source_id}`, {
        method: "GET",
        headers: {
            cookie: cookie_str,
            "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
        }
    })
    const data = await resp.json()
    if (data.code === 0) {
        return data.data.data.map(it => it.id)
    } else {
        console.log(data)
        return []
    }
}

/**
 * @param {number} page
 * @param {number} parent_area_id
 * @returns {Promise<[number,number][]>}
 */
async function getList(page, parent_area_id) {
    const resp = await fetch(`https://api.live.bilibili.com/xlive/web-interface/v1/second/getList?platform=web&parent_area_id=${parent_area_id}&page=${page}&area_id=0`, {
        method: "GET",
        headers: {
            cookie: cookie_str,
            "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
        }
    })
    const data = await resp.json()
    if (data.code === 0) {
        return data.data.list.map(it => [it.roomid, it.uid])
    } else {
        console.log(data)
        return []
    }
}

/**
 * @returns {Promise<number[]>}
 */
async function getAttentionList() {
    const resp = await fetch("https://api.vc.bilibili.com/feed/v1/feed/get_attention_list", {
        method: "GET",
        headers: {
            cookie: cookie_str,
            "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
        }
    })
    const data = await resp.json()
    if (data.code === 0) {
        return data.data.list || []
    } else {
        console.log(data)
        return []
    }
}

/**
 * @returns {Promise<[string,string,number]>}
 */
async function getBagList() {
    const resp = await fetch("https://api.live.bilibili.com/xlive/web-room/v1/gift/bag_list", {
        method: "GET",
        headers: {
            cookie: cookie_str,
            "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
        }
    })
    const data = await resp.json()
    if (data.code === 0) {
        return (data.data.list || []).map(it => [it.gift_name, it.corner_mark, it.gift_num])
    } else {
        console.log(data)
        return []
    }
}

/**
 * @param {Array<Promise<any>>} jobs
 */
async function pipe(jobs) {
    let last_value
    for (let job of jobs) {
        last_value = await job(last_value)
    }
}

function setGlobal(key) {
    return (value) => { global[key] = value }
}

/**
 * @template T
 * @param {(data: T) => void} fn
 * @returns {(arr: Array<T>) => void}
 */
function forEach(fn) {
    return (arr) => arr.forEach((it) => fn(it))
}

/**
 * @template T
 * @template U
 * @param {T[]} first
 * @returns {(second: U[]) => [T,U][]}
 */
function cross(first) {
    return (second) => {
        let cross = []
        first.forEach(f => second.forEach(s => cross.push([f, s])))
        return cross
    }
}

/**
 * 1..num
 * @param {number} num
 * @returns 
 */
function list(num) {
    return Array(num)
        .fill()
        .map((_, n) => n + 1)
}

/**
 * @template T
 * @param {(...params)=>Promise<T>|T} fn
 * @param {(params: T)=>void} callback
 * @returns {(arr: Array)=>void}
 */
function apply(fn, callback) {
    return (arr) => {
        const ret = fn(...arr)
        if (ret.then) {
            ret.then(callback)
        } else {
            callback(ret)
        }
    }
}

/**
 * 
 * @param {string} cookie_str
 * @returns {Map<string,string>}
 */
function parseCookie(cookie_str) {
    return new Map(
        cookie_str.split(/\s*;\s*/)
            .map(it => it.split('='))
    )
}

class RedPacketMonitor {
    constructor(roomid, ruid) {
        this.room_id = roomid;
        this.ruid = ruid;
        this.liveflow = null;
        this._no_relation_modify = false;
        this.has_redpacket = false;
        this.timer = 0;
        this.close_time = 300000;
    }

    static build(roomid, ruid) {
        return new RedPacketMonitor(roomid, ruid)
    }

    no_relation_modify() {
        this._no_relation_modify = true;
        return this
    }

    async start() {
        this.closeTimerUpdate()
        if (global.attention_list.includes(this.ruid)) {
            this.no_relation_modify()
        }
        this.liveflow = new LiveFlow()
            .setCookie(cookie_str)
            .setRoomId(this.room_id)
            .setUid(Number(global.cookie.get("DedeUserID")))
            .addCommandHandle("POPULARITY_RED_POCKET_START", async ({ data }) => {
                console.log(data);
                if (!this.has_redpacket) {
                    this.has_redpacket = true;
                    await this.relation_modify(1)
                }
                if (!this._no_relation_modify) {
                    fetch("https://api.live.bilibili.com/xlive/lottery-interface/v1/popularityRedPocket/RedPocketDraw", {
                        method: "POST",
                        headers: {
                            cookie: cookie_str,
                            "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
                            "content-type": "application/x-www-form-urlencoded"
                        },
                        body: stringify({
                            lot_id: data.lot_id,
                            csrf: global.cookie.get("bili_jct"),
                            csrf_token: global.cookie.get("bili_jct"),
                            visit_id: "",
                            jump_from: "",
                            session_id: "",
                            room_id: this.room_id,
                            ruid: this.ruid,
                            spm_id: "444.8.red_envelope.extract"
                        })
                    }).then(res => res.json()).then(res => {
                        console.log(res)
                        if (res.code === 0) {
                            clearTimeout(this.timer)
                            this.close_time = 300000 + data.last_time * 1000;
                            this.closeTimerUpdate()
                        }
                    });
                }
                getBagList().then(console.log)
            });
        await this.liveflow.run()
    }

    closeTimerUpdate() {
        console.log(`will disconnect in ${this.close_time}ms`);
        this.timer = setTimeout(() => {
            this.close()
        }, this.close_time);
    }

    async close() {
        if (this.has_redpacket) {
            await this.relation_modify(2)
        }
        this.liveflow.close()
    }

    /**
     * @param {number} act 1 关注 2 取关
     * @return {Promise<boolean>} ok -> true
     */
    async relation_modify(act) {
        if (this._no_relation_modify) {
            console.log(`relation_modify ${act} ${this.ruid} close`);
            return true
        }
        const resp = await fetch("https://api.bilibili.com/x/relation/modify", {
            method: "POST",
            headers: {
                cookie: cookie_str,
                "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
                "content-type": "application/x-www-form-urlencoded"
            },
            body: stringify({
                fid: this.ruid,
                act,
                re_src: 0,
                csrf: global.cookie.get("bili_jct")
            })
        })
        const data = await resp.json()
        if (data.code !== 0) {
            console.log(`relation_modify ${act} ${this.ruid} error`, data);
            return false
        } else {
            console.log(`relation_modify ${act} ${this.ruid} ok`);
            return true
        }
    }
}

pipe([
    () => cookie_str,
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
            red_packet_monitor => red_packet_monitor.start()
        ))
    ))
])