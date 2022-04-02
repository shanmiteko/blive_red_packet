/**
 * 1..num
 * @param {number} num
 * @returns
 */
function list(num) {
    return Array(num)
        .fill()
        .map((_, n) => n + 1);
}

function sleep(sec) {
    return new Promise((resolve) => {
        setTimeout(resolve, sec * 1000);
    });
}

module.exports = {
    list,
    sleep
};
