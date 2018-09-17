First, thank you for contributing to DIM! We're a community-driven project and we appreciate improvements large and small.

Here are some tips to make sure your pull request can be merged smoothly:

1. If you want to add a feature or make some change to DIM, consider [filing an issue](https://github.com/DestinyItemManager/DIM/issues/new) describing your idea first. This will give the DIM community a chance to discuss the idea, offer suggestions and pointers, and make sure what you're thinking of fits with the style and direction of DIM. If you want a more free-form chat, [join our Discord](https://discordapp.com/invite/UK2GWC7).
2. Resist the temptation to change more than one thing in your PR. Keeping PRs focused on a single change makes them much easier to review and accept. If you want to change multiple things, or clean up/refactor the code, make a new branch and submit those changes as a separate PR.
3. Please follow the existing style of DIM code when making your changes. While there's certainly room for improvement in the DIM codebase, if everybody used their favorite code style nothing would match up.
4. You can use any ES6/ES2015 features - we use Babel to compile out any features too new for browsers. We are also encouraging developers to write new code in [TypeScript](https://typescriptlang.org) and to use React instead of AngularJS where possible.
5. Take advantage of the [native JavaScript Array methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) and the [Underscore](http://underscorejs.org) library to write compact, easy-to-understand code.
6. Be sure to run `yarn run lint` before submitting your PR - it'll catch most style problems and make things much easier to merge.
7. Don't forget to add a description of your change to `CHANGELOG.md` so it'll be included in the release notes!

## Developer Quick start
Clone the repo:

* `git clone https://github.com/DestinyItemManager/DIM.git`

Install dependencies:

* Install [NodeJS](https://nodejs.org/).
* Install [Yarn](https://yarnpkg.com/en/docs/install). If you're used to NPM, see "[Migrating from NPM](https://yarnpkg.com/lang/en/docs/migrating-from-npm/)". If you were already using NPM with DIM, run `yarn` to convert to Yarn. **Note (2018/4/25): Yarn from Homebrew will come with NodeJS 10, which isn't ready for prime time. Either install via `npm install -g yarn` or downgrade Node after installing.**
* Windows-based developers will need to install `windows-build-tools` (`yarn global add windows-build-tools`) globally prior to running `yarn install`. Refer to issue #1439 for [details](https://github.com/DestinyItemManager/DIM/issues/1439).
* Linux-based developers will need to install `build-essential` (`sudo apt-get install -y build-essential`) prior to runninng `yarn install`.
* Run `yarn install`.
  * Note that on Windows, the Git Bash shell may fail to fetch all necessary packages even when run as Admin ([details](https://github.com/DestinyItemManager/DIM/issues/2487)). If that's the case, simply use cmd as Admin instead.
* It is highly recommended to use [VSCode](https://code.visualstudio.com/) to work on DIM. When you open DIM in VSCode, accept the recommended plugins it suggests.

Check code Style
* `yarn lint` will tell you if you're following the DIM code style (and automatically fix what it can).

Run your own local web server
* Run `openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem -subj '/CN=www.mydom.com/O=My Company Name LTD./C=US'` to generate server certificates.
* After the one-time setup, run `yarn start` and you're off to the races. Changes to CSS or React components should show up automatically without needing to reload the page (watch the console for details).

Get your own API key:

1. Goto [Bungie](https://www.bungie.net/en/Application)
1. Click `Create New App`
1. Enter any application name, and `https://github.com/YourGithubUsername/DIM`
1. For `Oauth Client type` select `Confidential`
1. Set your redirect url to `https://127.0.0.1:8080/return.html` (or whatever the IP or hostname is of your dev server)
1. Select all scopes _except_ the Administrate Groups/Clans
1. Enter `https://127.0.0.1:8080` as the `Origin Header`
1. Run `yarn install && yarn start`
1. Copy your API-key, Oauth Client_id, and OAuth client_secret from bungie.net into DIM developer settings panel when it is loaded.

Check out the [docs](https://github.com/DestinyItemManager/DIM/blob/master/docs) folder for more tips.
