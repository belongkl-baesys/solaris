const moment = require('moment');
const ValidationError = require('../errors/validation');
const mongoose = require('mongoose');

function arrayIsEqual(a, b) {
    if (a.length !== b.length) return false;

    const uniqueValues = new Set([...a, ...b]);

    for (const v of uniqueValues) {
        const aCount = a.filter(e => e === v).length;
        const bCount = b.filter(e => e === v).length;

        if (aCount !== bCount) return false;
    }

    return true;
}

function getNewConversation(game, playerId, name, participantIds) {
    if (name == null || !name.length || name.length > 100) {
        throw new ValidationError(`Name is required and must not exceed 100 characters.`);
    }

    // TODO: Check if a convo already exists with this name?

    // Append the current player ID to the participants if it isn't there already.
    if (playerId && !participantIds.find(x => x.toString() === playerId.toString())) {
        participantIds.unshift(playerId.toString());
    }

    if (participantIds.length < 2) {
        throw new ValidationError(`There must be at least 2 participants including yourself.`);
    }

    // Validate that another conversation doesn't already exist with the same participants.
    let existingConvo = game.conversations
        .filter(c => c.participants.length === participantIds.length)
        .find(c => arrayIsEqual(c.participants.map(p => p.toString()), participantIds));

    if (existingConvo) {
        throw new ValidationError(`A conversation already exists with the selected participants named [${existingConvo.name}].`);
    }

    let convoId = new mongoose.Types.ObjectId();

    let newConvo = {
        _id: convoId,
        name,
        createdBy: playerId,
        participants: participantIds
    };

    return newConvo;
}

module.exports = class ConversationService {

    constructor(gameModel, eventModel) {
        this.gameModel = gameModel;
        this.eventModel = eventModel;
    }

    async create(game, playerId, name, participantIds) {
        let newConvo = getNewConversation(game, playerId, name, participantIds);

        // Create the convo.
        await this.gameModel.updateOne({
            _id: game._id
        }, {
            $push: {
                conversations: newConvo
            }
        });

        return newConvo;
    }

    createConversationAllPlayers(game) {
        let name = game.settings.general.name;
        let participantIds = game.galaxy.players.map(p => p._id.toString());

        let newConvo = getNewConversation(game, null, name, participantIds);

        game.conversations.push(newConvo);
    }

    async list(game, playerId) {
        // List all conversations the player is participating in
        // and the last message that was sent
        // and the count of unread messages
        let convos = game.conversations.filter(c => c.participants.find(p => p.equals(playerId)));

        convos.forEach(c => {
            // Only return the last message
            c.lastMessage = c.messages.slice(-1)[0] || null;

            // Calculate how many messages in this conversation the player has NOT read.
            c.unreadCount = c.messages.filter(m => m.readBy.find(r => r.equals(playerId)) == null).length;

            delete c.messages;
        });

        return convos;
    }

    async detail(game, playerId, conversationId) {
        // Get the conversation that the player has requested in full.
        let convo = game.conversations.find(c => c._id.toString() === conversationId.toString());

        if (convo == null) {
            throw new ValidationError(`The conversation requested does not exist.`);
        }

        if (convo.participants.find(p => p.equals(playerId) == null)) {
            throw new ValidationError(`You are not participating in this conversation.`);
        }

        convo.messages.forEach(m => {
            m.type = 'message'; // Append the type of message as we may add trade events.
        });

        // If there are only two participants, then include any trade events that occurred
        // between the players.
        if (convo.participants.length === 2) {
            let events = await this._getTradeEventsBetweenParticipants(game, playerId, convo.participants);

            convo.messages = convo.messages.concat(events);
        }

        // Sort by sent date ascending.
        convo.messages = convo.messages.sort((a, b) => a.sentDate - b.sentDate);
        
        return convo;
    }

    async send(game, playerId, conversationId, message) {
        let convo = await this.detail(game, playerId, conversationId); // Call this for the validation.

        let newMessage = {
            fromPlayerId: playerId,
            message,
            sentDate: moment().utc(),
            readBy: [playerId]
        };

        // Push a new message into the conversation messages array.
        await this.gameModel.updateOne({
            _id: game._id,
            'conversations._id': conversationId
        }, {
            $push: {
                'conversations.$.messages': newMessage
            }
        });

        newMessage.conversationId = conversationId;
        newMessage.type = 'message';
        newMessage.toPlayerIds = convo.participants.filter(p => p.toString() !== playerId.toString());

        return newMessage;
    }

    async markConversationAsRead(game, playerId, conversationId) {
        let convo = await this.detail(game, playerId, conversationId);

        await this.gameModel.updateOne({
            _id: game._id,
            'conversations._id': conversationId
        },
        {
            $addToSet: {
                'conversations.$.messages.$[].readBy': playerId
            }
        });

        return convo;
    }

    async markMessageAsRead(game, playerId, conversationId, messageId) {
        await this.gameModel.updateOne({
            _id: game._id,
            'conversations.messages._id': messageId
        },
        {
            $addToSet: {
                'conversations.messages.$.readBy': playerId
            }
        });
    }

    async _getTradeEventsBetweenParticipants(game, playerId, participants) {
        let events = await this.eventModel.find({
            gameId: game._id,
            playerId: playerId,
            type: {
                $in: [
                    'playerCreditsReceived',
                    'playerRenownReceived',
                    'playerTechnologyReceived',
                    'playerCreditsSent',
                    'playerRenownSent',
                    'playerTechnologySent'
                ]
            }
        })
        .lean({ defaults: true })
        .exec();

        return events.map(e => {
            return {
                playerId: e.playerId,
                type: e.type,
                data: e.data,
                sentDate: moment(e._id.getTimestamp())
            }
        });
    }

    getUnreadCount(game, playerId) {
        return game.conversations
            .filter(c => c.participants.find(p => p.equals(playerId)))
            .reduce((sum, c) => {
                return sum + c.messages.filter(m => m.readBy.find(r => r.equals(playerId)) == null).length
            }, 0);
    }

}