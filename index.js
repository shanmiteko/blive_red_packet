const { stringify } = require('querystring');
const { LiveFlow } = require("bili-live-comment-ws");
const { cookie, cookies = [] } = require("./cookie.json");
const { default: axios } = require('axios');

/**
 * @template T,U
 * @param {Array<U|Promise<U>|(param: T)=>Promise<U>|U>} jobs
 */
async function pipe(jobs) {
    let last_value
    for (let job of jobs) {
        try {
            if (job instanceof Function) {
                const result = job(last_value)
                if (result instanceof Promise) {
                    last_value = await result
                } else {
                    last_value = result
                }
            } else if (job instanceof Promise) {
                last_value = await job
            } else {
                last_value = job
            }
        } catch (error) {
            console.log(error.message)
            break
        }
    }
    return last_value
}

/**
 * @param {Promise<any>[]} promises
 */
async function waitAll(promises) {
    return await Promise.all(promises)
}

/**
 * @param {string} method
 * @param {Array<any>} [params] 
 */
function call(method, params = []) {
    return (object) => object[method](...params)
}

/**
 * @template T
 * @param {T[]} arr
 * @return {(a: T) => T[]}
 */
function push(arr) {
    return (a) => {
        a && arr.push(a)
        return arr
    }
}

/**
 * @template T
 * @param {T} a
 * @return {(arr: T[]) => T[]}
 */
function insert(a) {
    return async (arr) => {
        if (a instanceof Promise) {
            a = await a
        }
        a && arr.push(a)
        return arr
    }
}

/**
 * @template T,U
 * @param {(a: T)=>U} fn
 * @returns {(arr: T[])=>U[]}
 */
function map(fn) {
    return (arr) => arr.map(fn)
}

/**
 * @template T,U
 * @param {T[]|Promise<T[]>} second
 * @returns {(second: U[]) => Promise<[T,U][]>}
 */
function cross(second) {
    return async (first) => {
        if (second instanceof Promise) {
            second = await second
        }
        let cross = []
        for (const s of second) {
            for (const f of first) {
                cross.push([f, s])
            }
        }
        return cross
    }
}

/**
 * 
 * @param {number} depth
 * @returns
 */
function flat(depth) {
    return (arr) => arr.flat(depth)
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
 */
function apply(fn) {
    return async (arr) => {
        const ret = fn(...arr)
        if (ret instanceof Promise) {
            return await ret
        } else {
            return ret
        }
    }
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
     * @param {string} [cookie]
     * @returns
     */
    static build(cookie) {
        return new BUser(cookie)
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
            .set(request.method)
            .set(JSON.stringify(request.params), result)
        return this
    }

    /**
     * @param {number} source_id
     * @returns {Promise<number[]>}
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
        this.timer = 0;
        this.close_time = 300000;
    }

    /**
     * @param {number} roomid
     * @param {number} ruid
     * @param {BUser[]} busers
     * @returns 
     */
    static build(roomid, ruid, busers) {
        return new RedPacketMonitor(roomid, ruid, busers)
    }

    async start() {
        this.closeTimerUpdate(this.close_time)
        this.liveflow = new LiveFlow()
            .setRoomId(this.room_id)
            .addCommandHandle("POPULARITY_RED_POCKET_START", ({ data }) => {
                console.log("POPULARITY_RED_POCKET_START", data)
                this.has_redpacket = true
                this.closeTimerUpdate(300000 + data.last_time * 1000)
                this.busers.forEach(buser => {
                    Promise.all([
                        buser.cookie.get("DedeUserID"),
                        buser
                            .drawRedPocket(data.lot_id, this.room_id, this.ruid)
                            .catch(it => it.message),
                        buser
                            .getBagList()
                            .catch(it => it.message)
                    ]).then(it => console.log(...it))
                })
            })
        await this.liveflow.run()
    }

    closeTimerUpdate(close_time) {
        clearTimeout(this.timer)
        console.log(`will disconnect in ${close_time}ms`);
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
                        .catch((err) => console.log(err.message))
                }
            })
        )
        this.liveflow.close()
    }
}

const announce_buser = new BUser()

pipe([
    announce_buser.getAreaList(),
    cross(list(2)),
    map(apply(announce_buser.getRoomListPair.bind(announce_buser))),
    waitAll,
    flat(1),
    map(insert(
        pipe([
            cookie,
            push(cookies),
            map(BUser.build),
            map(call("cache", [{ method: "getAttentionList" }])),
            waitAll,
        ])
    )),
    waitAll,
    map(apply(RedPacketMonitor.build)),
    waitAll,
    map(call("start")),
    waitAll
])