const { LiveFlow } = require("bili-live-comment-ws");
const { sleep } = require("./util");

class RedPacketMonitor {
    /**
     * @param {number} roomid
     * @param {number} ruid
     * @param {import("./buser").BUser[]} busers 
     */
    constructor(roomid, ruid, busers) {
        this.busers = busers;
        this.room_id = roomid;
        this.ruid = ruid;
        this.liveflow = null;
        this.has_redpacket = false;
        this.enable_web_heart = false
        this.remove_time = 0;
        this.draw_delay = 0;
        this.timer = 0;
        this.close_time = 3 * 60 * 1000;
        this.total_price_limit = 0;
    }

    log(...args) {
        console.log(`ROOM(${this.room_id})`, `UID(${this.ruid})`, ...args);
    }

    /**
     * @param {number} total_price_limit
     * @returns
     */
    setTotalPriceLimit(total_price_limit) {
        this.total_price_limit = total_price_limit;
        return this;
    }

    /**
     * 0-180s
     * @param {number} delay
     * @returns
     */
    setDrawDelay(delay) {
        this.draw_delay = delay;
        return this;
    }

    async start() {
        this.closeTimerUpdate(this.close_time);
        this.liveflow = new LiveFlow()
            .setRoomId(this.room_id)
            .addCommandHandle("POPULARITY_RED_POCKET_START", ({ data }) => {
                this.log("POPULARITY_RED_POCKET_START", data);
                if (data.total_price > this.total_price_limit) {
                    this.webHeartBeat()
                    this.has_redpacket = true;
                    const data_now = ~~(Date.now() / 1000);
                    const { last_time, remove_time } = data;
                    // start_time + last_time -> end_time + 10s -> replace_time + 5s -> remove_time
                    setTimeout(() => {
                        this.busers.forEach(buser => {
                            Promise.all([
                                `YOU(${buser.cookie.get("DedeUserID")})`,
                                buser
                                    .drawRedPocket(data.lot_id, this.room_id, this.ruid)
                                    .catch(it => it.message),
                                buser
                                    .getBagList()
                                    .catch(it => it.message)
                            ]).then(it => this.log(...it));
                        });
                    }, (this.draw_delay % last_time) * 1000 + (this.remove_time && (this.remove_time - data_now)));
                    this.remove_time = remove_time;
                    this.closeTimerUpdate(this.remove_time - data_now + this.close_time);
                } else {
                    this.log(data.total_price, '<', this.total_price_limit);
                }
            })
            .addCommandHandle("POPULARITY_RED_POCKET_WINNER_LIST", ({ data }) => {
                for (const winner of data.winner_info) {
                    for (const buser of this.busers) {
                        const uid = buser.cookie.get("DedeUserID");
                        if (winner.uid == uid) {
                            this.log("POPULARITY_RED_POCKET_WINNER_LIST", `YOU(${uid})`, "GET");
                            return;
                        }
                    }
                }
                this.log("POPULARITY_RED_POCKET_WINNER_LIST", "NO");
            });
        await this.liveflow.run();
    }

    webHeartBeat() {
        if (!this.enable_web_heart) {
            this.enable_web_heart = true
            this.busers.forEach(async buser => {
                let next_interval = 6
                while (this.enable_web_heart) {
                    next_interval = await buser.webHeartBeat(next_interval, this.room_id)
                    this.log(`YOU(${buser.cookie.get("DedeUserID")})`, "WEB_HEART_BEAT", next_interval)
                    await sleep(next_interval)
                }
            })
        }
    }

    closeTimerUpdate(close_time) {
        clearTimeout(this.timer);
        this.log(`will disconnect in ${close_time}ms`);
        this.timer = setTimeout(() => {
            this.enable_web_heart = false;
            this.close();
        }, close_time);
    }

    async close() {
        await Promise.all(
            this.busers.map((buser) => {
                let attention_list = buser.get({ method: "getAttentionList" });
                if (!attention_list.includes(this.ruid) && this.has_redpacket) {
                    return buser
                        .relationModify(this.ruid, 2)
                        .catch((err) => this.log(err.message));
                }
            })
        );
        this.liveflow.close();
    }
}

module.exports = { RedPacketMonitor };
