

module.exports = class NameService {

    constructor(gameNames, starNames, randomService) {
        this.gameNames = gameNames;
        this.starNames = starNames;
        this.randomService = randomService;
    }

    getRandomStarName() {
        return this.starNames[this.randomService.getRandomNumber(this.starNames.length - 1)];
    }

    getRandomGameName() {
        return this.gameNames[this.randomService.getRandomNumber(this.gameNames.length - 1)];
    }

    getRandomStarNames(count) {
        const list = [];

        do {
            let nextName = this.getRandomStarName();
            let i = 1
            while(list.includes(nextName)) {
              nextName = nextName.slice(0, -1) + i.toString()
              i++
            }
            list.push(nextName)
    
        } while (list.length < count);

        return list;
    }

};
