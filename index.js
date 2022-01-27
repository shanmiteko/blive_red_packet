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
 * @param {number} parent_area_id
 * @param {number} area_id
 * @param {number} page
 * @returns {Promise<[number,number][]>}
 */
async function getList(parent_area_id, area_id, page) {
    const resp = await fetch(`https://api.live.bilibili.com/xlive/web-interface/v1/second/getList?platform=web&parent_area_id=${parent_area_id}&page=${page}&area_id=${area_id}`, {
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

class CookiePaser {
    /**
     * @param {string} cookie
     */
    constructor(cookie) {
        this.cookie = new Map(
            cookie.split(/\s*;\s*/)
                .map(it => it.split('='))
        )
    }

    get(key) {
        return this.cookie.get(key)
    }
}

const cookie = new CookiePaser(cookie_str);

class RedPacketMonitor {
    constructor(roomid, ruid) {
        this.room_id = roomid;
        this.ruid = ruid;
        this.liveflow = null;
        this._no_relation_modify = false;
        this.has_redpacket = false;
        this.timer = 0;
        this.close_time = Date.now() + 300000000;
    }

    no_relation_modify() {
        this._no_relation_modify = true;
        return this
    }

    async start() {
        this.closeTimerUpdate()
        this.liveflow = new LiveFlow()
            .setCookie(cookie_str)
            .setRoomId(this.room_id)
            .setUid(Number(cookie.get("DedeUserID")))
            .addCommandHandle("POPULARITY_RED_POCKET_START", async (msg) => {
                console.log(msg);
                if (!this.has_redpacket) {
                    this.has_redpacket = true;
                    await this.relation_modify(1)
                }
                fetch("https://api.live.bilibili.com/xlive/lottery-interface/v1/popularityRedPocket/RedPocketDraw", {
                    method: "POST",
                    headers: {
                        cookie: cookie_str,
                        "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
                        "content-type": "application/x-www-form-urlencoded"
                    },
                    body: stringify({
                        lot_id: msg.data.lot_id,
                        csrf: cookie.get("bili_jct"),
                        csrf_token: cookie.get("bili_jct"),
                        visit_id: "",
                        jump_from: "",
                        session_id: "",
                        room_id: this.room_id,
                        ruid: this.ruid,
                        spm_id: "444.8.red_envelope.extract"
                    })
                }).then(res => res.json()).then(data => {
                    console.log(data)
                    if (data.code === 0) {
                        clearTimeout(this.timer)
                        this.close_time += msg.last_time * 1000000;
                        this.closeTimerUpdate()
                    }
                });
            });
        this.liveflow.run()
    }

    closeTimerUpdate() {
        console.log(`will disconnect in ${this.close_time}`);
        this.timer = setTimeout(() => {
            this.close()
        }, this.close_time - Date.now());
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
                csrf: cookie.get("bili_jct")
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

getAreaList().then(ids => {
    ids.forEach(id => {
        getList(id, 0, 1).then(args => {
            args.forEach(arg => {
                let red_packet_monitor = new RedPacketMonitor(...arg)
                red_packet_monitor.start()
            })
        })
    })
})
