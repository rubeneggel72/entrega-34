
process.on('message', msg => {
    const sum = calculo(msg)
    process.send(sum)
})

const calculo = (cant) => {
    var randonNumbers = []
    var randomNumbersObjeto = []
    for (let i = 0; i <= cant; i++) {
        randonNumbers.push(Math.floor(Math.random() * 1000));
    }
    for (let i = 0; i < 1000; i++) {
        let count = 0
        for (let j = 0; j < cant; j++) {
            if (randonNumbers[j] == i) count++
        }
        if (count > 0) {
            var newObj = {};
            newObj[i] = count;
            randomNumbersObjeto.push(newObj)
        }
    }
    let sum = 0
    for (let i = 0; i < 6e4; i++) {
        sum += i
    }
    return JSON.stringify(randomNumbersObjeto)
}
