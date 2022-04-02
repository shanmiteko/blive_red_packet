const { stringify } = require('querystring');
const { default: axios } = require('axios');

class BUser {
    /**
     * @param {string} [cookie]
     */
    constructor(cookie = "") {
        const user_agent = "Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0"
        this.default_headers = {
            cookie,
            user_agent
        }
        /**
         * @type {Map<string,string>}
         */
        this.cookie = new Map(
            cookie.split(/\s*;\s*/)
                .map(it => it.split('='))
        )
        this.axios = axios.create({
            headers: this.default_headers
        })
        /**
         * @type {Map<string,Map<any,any>>}
         */
        this._cache = new Map();
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
                .get(JSON.stringify(request.params));
        }
    }

    /**
     * @typedef Request
     * @property {string} method
     * @property {any[]} [params]
     * @param {Request} request
     */
    async cache(request) {
        const result = await this[request.method](...(request.params || []));
        if (!this._cache.has(request.method)) {
            this._cache.set(request.method, new Map());
        }
        this._cache
            .get(request.method)
            .set(JSON.stringify(request.params), result);
        return this;
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
        );
        if (data.code === 0) {
            return data.data.data.map(it => it.id);
        } else {
            console.log(data);
            return [];
        }
    }

    /**
     * @param {number} parent_area_id
     * @param {number} area_id
     * @param {number} page
     * @returns {Promise<[number,number][]>} `[roomid, uid][]`
     */
    async getRoomListPair(parent_area_id, area_id, page) {
        const { data } = await this.axios.get(
            "https://api.live.bilibili.com/xlive/web-interface/v1/second/getList",
            {
                params: {
                    platform: "web",
                    parent_area_id,
                    area_id,
                    page
                }
            }
        );
        if (data.code === 0) {
            return data.data.list.map(it => [it.roomid, it.uid]);
        } else {
            console.log(data);
            return [];
        }
    }

    /**
     * @param {number} room_id
     * @returns {number[]} `[parent_area_id, area_id]`
     */
    async getAreaInfoByRoomId(room_id) {
        const { data } = await this.axios.get(
            "https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom",
            {
                params: {
                    room_id
                }
            }
        );
        if (data.code === 0) {
            const { parent_area_id, area_id } = data.data.room_info;
            return [parent_area_id, area_id]
        } else {
            console.log(data);
            return [];
        }
    }

    /**
     * @returns {Promise<number[]>}
     */
    async getAttentionList() {
        const { data } = await this.axios.get(
            "https://api.vc.bilibili.com/feed/v1/feed/get_attention_list"
        );
        if (data.code === 0) {
            return data.data.list || [];
        } else {
            console.log(data);
            return [];
        }
    }

    /**
     * @returns {Promise<[string,string,number]>}
     */
    async getBagList() {
        const { data } = await this.axios.get(
            "https://api.live.bilibili.com/xlive/web-room/v1/gift/bag_list"
        );
        if (data.code === 0) {
            return (data.data.list || []).map(it => [it.gift_name, it.corner_mark, it.gift_num]);
        } else {
            console.log(data);
            return [];
        }
    }

    /**
     * 
     * @param {number} next_interval
     * @param {number} room_id
     * @returns {Promise<number>} next_interval
     */
    async webHeartBeat(next_interval, room_id) {
        const { data } = await this.axios.get(
            "https://live-trace.bilibili.com/xlive/rdata-interface/v1/heartbeat/webHeartBeat",
            {
                params: {
                    hb: Buffer.from(`${next_interval}|${room_id}|1|0`).toString("base64"),
                    pf: "web"
                }
            }
        )
        if (data.code === 0) {
            return data.data.next_interval
        } else {
            console.log(data);
            return 60
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
        );
        if (data.code === 0) {
            console.log('drawRedPocket', 'ok');
            return true;
        } else {
            console.log('drawRedPocket', 'error', data);
            return false;
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
        );
        if (data.code === 0) {
            console.log(`relationModify ${act} ${fid}`, 'ok');
            return true;
        } else {
            console.log(`relationModify ${act} ${fid}`, "error", data);
            return false;
        }
    }
}

module.exports = { BUser };
