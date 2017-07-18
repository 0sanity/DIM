import { flatMap } from '../util';

import template from './account-select.html';
import dialogTemplate from './account-select.dialog.html';
import './account-select.scss';

export const AccountSelectComponent = {
  template,
  controller: AccountSelectController,
  bindings: {
    destinyVersion: '<'
  }
};

function AccountSelectController($scope, dimPlatformService, loadingTracker, ngDialog, OAuthTokenService, $state) {
  'ngInject';

  const vm = this;
  let dialogResult = null;

  vm.loadingTracker = loadingTracker;
  vm.accounts = [];

  vm.$onChanges = function(changes) {
    // If we go to a non-destiny-account page, leave it, or default to D1
    vm.destinyVersion = changes.destinyVersion.currentValue || vm.destinyVersion || 1;
    if (vm.currentAccount) {
      vm.currentAccount.destinyVersion = vm.destinyVersion;
    }
    console.log(changes.destinyVersion, vm.destinyVersion);
  };

  function setAccounts(accounts) {
    vm.accounts = flatMap(accounts, (account) => {
      // TODO: this doesn't really work. Should we have a version switch instead?

      // Duplicate each Destiny account, since they may have played either D1 or D2.
      // TODO: Maybe push this into the account service, and allow people to "hide" accounts?
      return [
        Object.assign({}, account, { destinyVersion: 1 }),
        Object.assign({}, account, { destinyVersion: 2 })
      ];
    });
  }

  // TODO: will we need some event to change this when the destiny version changes? Or evaluate on state changes?
  // TODO: save this in the account service, or some other global state, so we don't flip flop
  function setCurrentAccount(currentAccount) {
    vm.currentAccount = Object.assign({}, currentAccount, { destinyVersion: vm.destinyVersion });
  }

  vm.accountChange = function accountChange(account) {
    loadingTracker.addPromise(dimPlatformService.setActive(account));
  };

  $scope.$on('dim-platforms-updated', (e, args) => {
    setAccounts(args.platforms);
  });

  $scope.$on('dim-active-platform-updated', (e, args) => {
    setCurrentAccount(args.platform);
  });

  const loadAccountsPromise = dimPlatformService.getPlatforms()
    .then((accounts) => {
      setAccounts(accounts);
      setCurrentAccount(dimPlatformService.getActive());
    });
  loadingTracker.addPromise(loadAccountsPromise);

  vm.logOut = function(e) {
    e.stopPropagation();

    OAuthTokenService.removeToken();
    $state.go('login', { reauth: true });
  };

  vm.selectAccount = function(e, account) {
    e.stopPropagation();
    // TODO: but what version??
    $state.go(account.destinyVersion === 1 ? 'destiny1' : 'destiny2', account);
  };

  vm.openDropdown = function(e) {
    e.stopPropagation();

    if (dialogResult === null) {
      ngDialog.closeAll();

      dialogResult = ngDialog.open({
        template: dialogTemplate,
        appendTo: `account-select`,
        overlay: false,
        className: 'accounts-popup',
        showClose: false,
        controllerAs: '$ctrl',
        controller: function($scope) {
          'ngInject';
          // TODO: reorder accounts by LRU?
          console.log('destinyVersion', vm.destinyVersion);
          this.accounts = vm.accounts.filter((p) => {
            return p.membershipId !== vm.currentAccount.membershipId ||
            p.platformType !== vm.currentAccount.platformType ||
            p.destinyVersion !== vm.destinyVersion;
          });
          this.selectAccount = (e, account) => {
            $scope.closeThisDialog(); // eslint-disable-line angular/controller-as
            vm.selectAccount(e, account);
          };
          this.logOut = (e) => {
            $scope.closeThisDialog(); // eslint-disable-line angular/controller-as
            vm.logOut(e);
          };
        }
      });

      dialogResult.closePromise.then(() => {
        dialogResult = null;
      });
    } else {
      dialogResult.close();
    }
  };
}
