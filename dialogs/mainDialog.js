// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ConfirmPrompt, DialogSet, DialogTurnStatus, OAuthPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { LogoutDialog } = require('./logoutDialog');
const { TurnContext } = require('botbuilder');

const CONFIRM_PROMPT = 'ConfirmPrompt';
const MAIN_DIALOG = 'MainDialog';
const MAIN_WATERFALL_DIALOG = 'MainWaterfallDialog';
const OAUTH_PROMPT = 'OAuthPrompt';

class MainDialog extends LogoutDialog {
    constructor() {
        super(MAIN_DIALOG, process.env.connectionName);

        this.addDialog(new OAuthPrompt(OAUTH_PROMPT, {
            connectionName: process.env.connectionName,
            text: 'Please Sign In',
            title: 'Sign In',
            timeout: 300000
        }));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
            this.promptStep.bind(this),
            this.loginStep.bind(this),
            this.ensureOAuth.bind(this),
            this.callSecureAPI.bind(this)
        ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} dialogContext
     */
    async run(context, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        const dialogContext = await dialogSet.createContext(context);

        //dialogContext.context.activity.userState["message"] = context.activity.text;

        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    async promptStep(stepContext) {
        try {
            return await stepContext.beginDialog(OAUTH_PROMPT);
        } catch (err) {
            console.error(err);
        }
    }

    async loginStep(stepContext) {
        // Get the token from the previous step. Note that we could also have gotten the
        // token directly from the prompt itself. There is an example of this in the next method.
        const tokenResponse = stepContext.result;
        if (!tokenResponse || !tokenResponse.token) {
            await stepContext.context.sendActivity('Login was not successful please try again.');
        } else {
            
            // const client = new SimpleGraphClient(tokenResponse.token);
            // const me = await client.getMe();
            await stepContext.context.sendActivity(`You are successfully logged in.`);
            return await stepContext.next(tokenResponse);

        }
        return await stepContext.endDialog();
    }

    async ensureOAuth(stepContext) {
        //await stepContext.context.sendActivity('Thank you.');

        const result = stepContext.result;
        if (result) {
            // Call the prompt again because we need the token. The reasons for this are:
            // 1. If the user is already logged in we do not need to store the token locally in the bot and worry
            // about refreshing it. We can always just call the prompt again to get the token.
            // 2. We never know how long it will take a user to respond. By the time the
            // user responds the token may have expired. The user would then be prompted to login again.
            //
            // There is no reason to store the token locally in the bot because we can always just call
            // the OAuth prompt to get the token or get a new token if needed.
            return await stepContext.beginDialog(OAUTH_PROMPT);
        }
        return await stepContext.endDialog();
    }

    async callSecureAPI(stepContext) {
                
        // Access the turnContext
        var turnContext = stepContext.context;
        // Now you can access the user's message (NOTE: must be before 'stepContext.result' is called)
        var userMessage = turnContext.activity.text;
        // Get token response from previous step (NOTE: This invalidates 'stepContext.context')
        var tokenResponse = stepContext.result;
        
        if (tokenResponse && tokenResponse.token) {
            await stepContext.context.sendActivity(`Your Message: ${userMessage}`);
            await stepContext.context.sendActivity(`Here is your token to call your API ${tokenResponse.token}`);
        }
        return await stepContext.endDialog();
    }
}

module.exports.MainDialog = MainDialog;
