const { stringify } = require('querystring');
const { LiveFlow } = require("bili-live-comment-ws");
const { cookie, cookies = [] } = require("./cookie.json");
const { default: axios } = require('axios');

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

class BUser {
    /**
     * @param {string} cookie
     */
    constructor(cookie) {
        if (cookie) {
            this.axios = axios.create({
                headers: {
                    cookie,
                    "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
                }
            })
            /**
             * @type {Map<string,string>}
             */
            this.cookie = new Map(
                cookie.split(/\s*;\s*/)
                    .map(it => it.split('='))
            )
        } else {
            this.axios = axios.create({
                headers: {
                    "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0",
                }
            })
            this.cookie = new Map()
        }
        /**
         * @type {Map<string,Map<any,any>>}
         */
        this._cache = new Map()
    }

    /**
     * @typedef Request
     * @property {string} method
     * @property {any[]} [params]
     * @param {Request} request
     */
    get(request) {
        if (this._cache.has(request.method)) {
            return this._cache
                .get(request.method)
                .get(JSON.stringify(request.params))
        }
    }

    /**
     * @typedef Request
     * @property {string} method
     * @property {any[]} [params]
     * @param {Request} request
     */
    async cache(request) {
        const result = await this[request.method](...(request.params || []))
        if (!this._cache.has(request.method)) {
            this._cache.set(request.method, new Map())
        }
        this._cache
            .get(request.method)
            .set(JSON.stringify(request.params), result)
        return this
    }

    /**
     * @param {number} source_id
     * @returns {Promise<number[]>} `parent_area_id`
     */
    async getAreaList(source_id = 1) {
        const { data } = await this.axios.get(
            "https://api.live.bilibili.com/xlive/web-interface/v1/index/getWebAreaList",
            {
                params: {
                    source_id
                }
            }
        )
        if (data.code === 0) {
            return data.data.data.map(it => it.id)
        } else {
            console.log(data)
            return []
        }
    }

    /**
     * @param {number} parent_area_id
     * @param {number} page
     * @returns {Promise<[number,number][]>} `[roomid, uid][]`
     */
    async getRoomListPair(parent_area_id, page) {
        const { data } = await this.axios.get(
            "https://api.live.bilibili.com/xlive/web-interface/v1/second/getList",
            {
                params: {
                    platform: "web",
                    parent_area_id,
                    page,
                    area_id: 0
                }
            }
        )
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
    async getAttentionList() {
        const { data } = await this.axios.get(
            "https://api.vc.bilibili.com/feed/v1/feed/get_attention_list"
        )
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
    async getBagList() {
        const { data } = await this.axios.get(
            "https://api.live.bilibili.com/xlive/web-room/v1/gift/bag_list"
        )
        if (data.code === 0) {
            return (data.data.list || []).map(it => [it.gift_name, it.corner_mark, it.gift_num])
        } else {
            console.log(data)
            return []
        }
    }

    /**
     * @param {number} lot_id
     * @param {number} room_id
     * @param {number} ruid
     * @returns {Promise<boolean>}
     */
    async drawRedPocket(lot_id, room_id, ruid) {
        const { data } = await this.axios.post(
            "https://api.live.bilibili.com/xlive/lottery-interface/v1/popularityRedPocket/RedPocketDraw",
            stringify({
                lot_id,
                csrf: this.cookie.get("bili_jct"),
                csrf_token: this.cookie.get("bili_jct"),
                visit_id: "",
                jump_from: "",
                session_id: "",
                room_id,
                ruid,
                spm_id: "444.8.red_envelope.extract"
            }),
            {
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                }
            }
        )
        if (data.code === 0) {
            console.log('drawRedPocket', 'ok');
            return true
        } else {
            console.log('drawRedPocket', 'error', data)
            return false
        }
    }

    /**
     * @param {number} fid uid
     * @param {number} act 1 关注 2 取关
     * @return {Promise<boolean>} ok -> true
     */
    async relationModify(fid, act) {
        const { data } = await this.axios.post(
            "https://api.bilibili.com/x/relation/modify",
            stringify({
                fid,
                act,
                re_src: 0,
                csrf: this.cookie.get("bili_jct")
            }),
            {
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                }
            }
        )
        if (data.code === 0) {
            console.log(`relationModify ${act} ${fid}`, 'ok');
            return true
        } else {
            console.log(`relationModify ${act} ${fid}`, "error", data);
            return false
        }
    }
}

class RedPacketMonitor {
    constructor(roomid, ruid, busers) {
        /**
         * @type {BUser[]}
         */
        this.busers = busers
        this.room_id = roomid;
        this.ruid = ruid;
        this.liveflow = null;
        this.has_redpacket = false;
        this.remove_time = 0;
        this.draw_delay = 0;
        this.timer = 0;
        this.close_time = 3 * 60 * 1000;
        this.total_price_limit = 0;
    }

    log(...args) {
        console.log(`room(${this.room_id})`, `uid(${this.ruid})`, ...args);
    }

    /**
     * @param {number} total_price_limit
     * @returns 
     */
    setTotalPriceLimit(total_price_limit) {
        this.total_price_limit = total_price_limit
        return this
    }

    /**
     * 0-180s
     * @param {number} delay
     * @returns
     */
    setDrawDelay(delay) {
        this.draw_delay = delay
        return this
    }

    async start() {
        this.closeTimerUpdate(this.close_time)
        this.liveflow = new LiveFlow()
            .setRoomId(this.room_id)
            .addCommandHandle("POPULARITY_RED_POCKET_START", ({ data }) => {
                this.log("POPULARITY_RED_POCKET_START", data)
                if (data.total_price > this.total_price_limit) {
                    this.has_redpacket = true
                    const data_now = ~~(Date.now() / 1000)
                    const { last_time, remove_time } = data
                    // start_time + last_time -> end_time + 10s -> replace_time + 5s -> remove_time
                    setTimeout(() => {
                        this.busers.forEach(buser => {
                            Promise.all([
                                `you(${buser.cookie.get("DedeUserID")})`,
                                buser
                                    .drawRedPocket(data.lot_id, this.room_id, this.ruid)
                                    .catch(it => it.message),
                                buser
                                    .getBagList()
                                    .catch(it => it.message)
                            ]).then(it => this.log(...it))
                        })
                    }, (this.draw_delay % last_time) * 1000 + (this.remove_time && (this.remove_time - data_now)))
                    this.remove_time = remove_time
                    this.closeTimerUpdate(this.remove_time - data_now + this.close_time)
                } else {
                    this.log(data.total_price, '<', this.total_price_limit)
                }
            })
            .addCommandHandle("POPULARITY_RED_POCKET_WINNER_LIST", ({ data }) => {
                for (const winner of data.winner_info) {
                    for (const buser of this.busers) {
                        const uid = buser.cookie.get("DedeUserID")
                        if (winner.uid == uid) {
                            this.log("POPULARITY_RED_POCKET_WINNER_LIST", `you(${uid})`, "GET")
                            return
                        }
                    }
                }
                this.log("POPULARITY_RED_POCKET_WINNER_LIST", "NO");
            })
        await this.liveflow.run()
    }

    closeTimerUpdate(close_time) {
        clearTimeout(this.timer)
        this.log(`will disconnect in ${close_time}ms`);
        this.timer = setTimeout(() => {
            this.close()
        }, close_time);
    }

    async close() {
        await Promise.all(
            this.busers.map((buser) => {
                let attention_list = buser.get({ method: "getAttentionList" })
                if (!attention_list.includes(this.ruid) && this.has_redpacket) {
                    return buser
                        .relationModify(this.ruid, 2)
                        .catch((err) => this.log(err.message))
                }
            })
        )
        this.liveflow.close()
    }
}

const announce_buser = new BUser()
const roomid_set = new Set()
const busers = {
    inner: [],
    /**
     * @returns {Promise<BUser[]>}
     */
    async get() {
        if (!this.inner.length) {
            for (const cookie of cookies) {
                const buser = new BUser(cookie)
                this.inner.push(await buser.cache({ method: "getAttentionList" }))
            }
        }
        return this.inner
    }
}

async function start() {
    for (const areaid of await announce_buser.getAreaList()) {
        for (const page of list(1)) {
            for (const [roomid, uid] of await announce_buser.getRoomListPair(areaid, page)) {
                if (!roomid_set.has(roomid)) {
                    roomid_set.add(roomid)
                    new RedPacketMonitor(roomid, uid, await busers.get())
                        .setTotalPriceLimit(0)
                        .setDrawDelay(100)
                        .start()
                        .catch(console.log)
                        .finally(() => roomid_set.delete(roomid))
                }
            }
        }
    }
}

// setInterval(start, 10 * 60 * 1000)

start()
