const ValidationError = require('../../errors/validation');

module.exports = (router, io, container) => {

    const middleware = require('../middleware')(container);

    router.put('/api/game/:gameId/trade/credits', middleware.authenticate, middleware.loadGame, middleware.validateGameInProgress, middleware.loadPlayer, middleware.validateUndefeatedPlayer, async (req, res, next) => {
        let errors = [];

        if (!req.body.toPlayerId) {
            errors.push('toPlayerId is required.');
        }

        if (req.session.userId === req.body.toPlayerId) {
            errors.push('Cannot send credits to yourself.');
        }
        
        req.body.amount = parseInt(req.body.amount || 0);

        if (!req.body.amount) {
            errors.push('amount is required.');
        }
        
        if (req.body.amount <= 0) {
            errors.push('amount must be greater than 0.');
        }

        if (errors.length) {
            throw new ValidationError(errors);
        }

        try {
            await container.tradeService.sendCredits(
                req.game,
                req.player,
                req.body.toPlayerId,
                req.body.amount);

            container.broadcastService.gamePlayerCreditsReceived(req.game, req.body.toPlayerId, req.body.amount);

            return res.sendStatus(200);
        } catch (err) {
            return next(err);
        }
    }, middleware.handleError);

    router.put('/api/game/:gameId/trade/renown', middleware.authenticate, middleware.loadGame, middleware.validateGameStarted, middleware.loadPlayer, async (req, res, next) => {
        let errors = [];

        if (!req.body.toPlayerId) {
            errors.push('toPlayerId is required.');
        }

        req.body.amount = parseInt(req.body.amount || 0);

        if (!req.body.amount) {
            errors.push('amount is required.');
        }
        
        if (req.body.amount <= 0) {
            errors.push('amount must be greater than 0.');
        }

        if (errors.length) {
            throw new ValidationError(errors);
        }

        try {
            await container.tradeService.sendRenown(
                req.game,
                req.player,
                req.body.toPlayerId,
                req.body.amount);

            // TODO: Implement receiving renown on the UI, should use a user socket.
            //container.broadcastService.userRenownReceived(req.game, // to user id, req.body.amount);

            return res.sendStatus(200);
        } catch (err) {
            return next(err);
        }
    }, middleware.handleError);

    router.put('/api/game/:gameId/trade/tech', middleware.authenticate, middleware.loadGame, middleware.validateGameInProgress, middleware.loadPlayer, middleware.validateUndefeatedPlayer, async (req, res, next) => {
        let errors = [];

        if (!req.body.toPlayerId) {
            errors.push('toPlayerId is required.');
        }

        if (errors.length) {
            throw new ValidationError(errors);
        }

        try {
            await container.tradeService.sendTechnology(
                req.game,
                req.player,
                req.body.toPlayerId,
                req.body.technology,
                req.body.level);

            return res.sendStatus(200);
        } catch (err) {
            return next(err);
        }
    }, middleware.handleError);

    router.get('/api/game/:gameId/trade/tech/:toPlayerId', middleware.authenticate, middleware.loadGame, middleware.validateGameInProgress, middleware.loadPlayer, middleware.validateUndefeatedPlayer, async (req, res, next) => {
        try {
            let techs = await container.tradeService.getTradeableTechnologies(
                req.game,
                req.player,
                req.params.toPlayerId);

            return res.status(200).json(techs);
        } catch (err) {
            return next(err);
        }
    }, middleware.handleError);

    return router;

};
