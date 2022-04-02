const { cookie, cookies = [] } = require("./cookie.json");
const { list } = require("./src/util");
const { BUser } = require("./src/buser");
const { RedPacketMonitor } = require("./src/redpacket_monitor");

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
            for (const [roomid, uid] of await announce_buser.getRoomListPair(areaid, 0, page)) {
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
