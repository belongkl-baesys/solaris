const moment = require('moment');

module.exports = class GameListService {
    
    constructor(gameModel) {
        this.gameModel = gameModel;
    }

    async listStatistics() {
        let result = await this.gameModel.aggregate([
            { "$facet": {
                'pending': [
                    { "$match" : { 'state.startDate': { $eq: null }, 'state.endDate': { $eq: null }}},
                    { "$count": "pending" }
                ],
                'inProgress': [
                    { "$match" : { 'state.startDate': { $ne: null }, 'state.endDate': { $eq: null }}},
                    { "$count": "inProgress" }
                ],
                'finished': [
                    { "$match" : { 'state.startDate': { $ne: null }, 'state.endDate': { $ne: null }}},
                    { "$count": "finished" }
                ]
            }},
            { "$project": {
                "pending": { "$arrayElemAt": ["$pending.pending", 0] },
                "inProgress": { "$arrayElemAt": ["$inProgress.inProgress", 0] },
                "finished": { "$arrayElemAt": ["$finished.finished", 0] }
            }}
        ]);

        if (result == null || !result.length || result[0] == null) {
            result = {
                pending: 0,
                inProgress: 0,
                finished: 0
            }
        } else {
            result = {
                pending: result[0].inProgress,
                inProgress: result[0].inProgress,
                finished: result[0].finished
            }
        }

        return result;
    }

    async listOfficialGames() {
        return await this.gameModel.find({
            'settings.general.createdByUserId': { $eq: null },
            'state.startDate': { $eq: null }
        })
        .sort({
            'settings.general.description': 1 // Sort description ascending
        })
        .select({
            'settings.general.name': 1,
            'settings.general.description': 1,
            'settings.general.playerLimit': 1,
            state: 1
        })
        .lean({ defaults: true })
        .exec();
    }

    async listUserGames() {
        return await this.gameModel.find({
            'settings.general.createdByUserId': { $ne: null },
            'state.startDate': { $eq: null }
        })
        .select({
            'settings.general.name': 1,
            'settings.general.playerLimit': 1,
            state: 1
        })
        .lean({ defaults: true })
        .exec();
    }

    async listActiveGames(userId) {
        return await this.gameModel.find({
            'galaxy.players': { $elemMatch: { userId } },   // User is in game
            $and: [                                         // and (game is in progress AND user's player is not defeated)
                { 'state.endDate': { $eq: null } },
                { 
                    'galaxy.players': { 
                        $elemMatch: { 
                            userId, 
                            defeated: { $in: [ null, false ] } // Defeated either not set or is false.
                        }
                    }
                }
            ]
        })
        .sort({
            'state.startDate': -1 // Sort start date descending (most recent started games appear first)
        })
        .select({
            'settings.general.name': 1,
            'settings.general.playerLimit': 1,
            state: 1
        })
        .lean({ defaults: true })
        .exec();
    }

    async listCompletedGames(userId) {
        return await this.gameModel.find({
            'galaxy.players': { $elemMatch: { userId } },   // User is in game
            $or: [                                          // and (game is in progress OR user's player is defeated)
                { 'state.endDate': { $ne: null } },
                { 'galaxy.players': { $elemMatch: { userId, defeated: true } } }
            ]
        })
        .sort({
            'state.startDate': -1 // Sort start date descending (most recent finished games appear first)
        })
        .select({
            'settings.general.name': 1,
            'settings.general.playerLimit': 1,
            state: 1
        })
        .lean({ defaults: true })
        .exec();
    }

    async listOldCompletedGames() {
        let date = moment().subtract(3, 'month');

        return await this.gameModel.find({
            'state.endDate': { $lt: date }
        })
        .exec();
    }

    async listInProgressGames() {
        return await this.gameModel.find({
            'state.startDate': { $lte: moment().utc().toDate() },
            'state.endDate': { $eq: null },
            'state.paused': { $eq: false }
        })
        .exec();
    }

    async listOpenGamesCreatedByUser(userId) {
        return await this.gameModel.find({
            'settings.general.createdByUserId': { $eq: userId },
            'state.startDate': { $eq: null }
        })
        .exec();
    }

};
