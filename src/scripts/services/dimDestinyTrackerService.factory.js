import angular from 'angular';
import _ from 'underscore';

angular.module('dimApp')
  .factory('dimDestinyTrackerService', DestinyTrackerService);

class gunTransformer {
  translateToDtrGun(gun) {
    return {
      referenceId: gun.hash,
      roll: this.getDtrRoll(gun)
    };
  }

  getRollAndPerks(gun) {
    return {
      roll: this.getDtrRoll(gun),
      selectedPerks: this.getDtrPerks(gun),
      referenceId: gun.hash,
      instanceId: gun.id,
    };
  }

  getDtrPerks(gun) {
    if (!gun.talentGrid) {
      return null;
    }

    return gun.talentGrid.dtrPerks;
  }

  getDtrRoll(gun) {
    if (!gun.talentGrid) {
      return null;
    }

    return gun.talentGrid.dtrRoll;
  }
}

class gunListBuilder {
  constructor() {
    this._gunTransformer = new gunTransformer();
  }

  getNewItems(allItems) {
    return _.where(allItems, { isNew: true });
  }

  getAllItems(stores) {
    var allItems = [];

    stores.forEach(function(store) {
      allItems = allItems.concat(store.items);
    });

    return allItems;
  }

  getGuns(stores) {
    var allItems = this.getAllItems(stores);

    var allGuns = _.filter(allItems,
                        function(item) {
                          if (!item.primStat) {
                            return false;
                          }

                          return (item.primStat.statHash === 368428387);
                        });

    var newGuns = this.getNewItems(allGuns);

    if (newGuns.length > 0) {
      return newGuns;
    }

    return allGuns;
  }

  getWeaponList(stores) {
    var guns = this.getGuns(stores);

    var list = [];
    var self = this;

    guns.forEach(function(gun) {
      var dtrGun = self._gunTransformer.translateToDtrGun(gun);

      if (!self.isKnownGun(list, dtrGun)) {
        list.push(dtrGun);
      }
    });

    return list;
  }

  isKnownGun(list, dtrGun) {
    return _.contains(list, dtrGun);
  }
}

class trackerErrorHandler {
  constructor($q,
              $translate) {
    this.$q = $q;
    this.$translate = $translate;
  }

  handleErrors(response) {
    if (response.status !== 200) {
      return this.$q.reject(new Error(this.$translate.instant('DtrReview.ServiceCallError')));
    }

    return response;
  }

  handleSubmitErrors(response) {
    if (response.status !== 204) {
      return this.$q.reject(new Error(this.$translate.instant('DtrReview.ServiceSubmitError')));
    }

    return response;
  }
}

class bulkFetcher {
  constructor($q, $http, trackerErrorHandler, loadingTracker) {
    this.$q = $q;
    this.$http = $http;
    this._gunListBuilder = new gunListBuilder();
    this._trackerErrorHandler = trackerErrorHandler;
    this._loadingTracker = loadingTracker;
  }

  getBulkWeaponDataPromise(gunList) {
    return {
      method: 'POST',
      url: 'https://reviews-api.destinytracker.net/api/weaponChecker/fetch',
      data: gunList,
      dataType: 'json'
    };
  }

  getBulkFetchPromise(stores) {
    if (stores.stores.length === 0) {
      return this.$q.resolve();
    }

    var weaponList = this._gunListBuilder.getWeaponList(stores.stores);

    var promise = this.$q
              .when(this.getBulkWeaponDataPromise(weaponList))
              .then(this.$http)
              .then(this._trackerErrorHandler.handleErrors, this._trackerErrorHandler.handleErrors)
              .then((response) => { return response.data; });

    this._loadingTracker.addPromise(promise);

    return promise;
  }

  bulkFetch(stores) {
    this.getBulkFetchPromise(stores)
      .then((bulkRankings) => this.attachRankings(bulkRankings,
                                                  stores.stores));
  }

  toAtMostOneDecimal(rating) {
    if (!rating) {
      return null;
    }

    if ((rating % 1) === 0) {
      return rating;
    }

    return rating.toFixed(1);
  }

  attachRankings(bulkRankings,
                 stores) {
    var self = this;

    if ((!bulkRankings) ||
        (!bulkRankings.length)) {
      return;
    }

    bulkRankings.forEach(function(bulkRanking) {
      stores.forEach(function(store) {
        store.items.forEach(function(storeItem) {
          if (storeItem.hash === Number(bulkRanking.referenceId)) {
            storeItem.dtrRating = self.toAtMostOneDecimal(bulkRanking.rating);
          }
        });
      });
    });
  }
}

class reviewsFetcher {
  constructor($q, $http, trackerErrorHandler, loadingTracker) {
    this.$q = $q;
    this.$http = $http;
    this._gunTransformer = new gunTransformer();
    this._trackerErrorHandler = trackerErrorHandler;
    this._loadingTracker = loadingTracker;
  }

  getItemReviewsCall(item) {
    return {
      method: 'POST',
      url: 'https://reviews-api.destinytracker.net/api/weaponChecker/reviews',
      data: item,
      dataType: 'json'
    };
  }

  getItemReviewsPromise(item) {
    var postWeapon = this._gunTransformer.getRollAndPerks(item);

    var promise = this.$q
              .when(this.getItemReviewsCall(postWeapon))
              .then(this.$http)
              .then(this._trackerErrorHandler.handleErrors, this._trackerErrorHandler.handleErrors)
              .then((response) => { return response.data; });

    this._loadingTracker.addPromise(promise);

    return promise;
  }

  getUserReview(reviewData) {
    return _.findWhere(reviewData.reviews, { isReviewer: true });
  }

  attachReviews(item,
                reviewData) {
    var userReview = this.getUserReview(reviewData);

    item.communityReviews = reviewData.reviews;

    if (userReview) {
      item.userRating = userReview.rating;
      item.userReview = userReview.review;
      item.userReviewPros = userReview.pros;
      item.userReviewCons = userReview.cons;
    }
  }

  getItemReviews(item) {
    this.getItemReviewsPromise(item)
      .then((data) => this.attachReviews(item,
                                         data));
  }
}

class reviewSubmitter {
  constructor($q, $http, dimPlatformService, trackerErrorHandler, loadingTracker) {
    this.$q = $q;
    this.$http = $http;
    this._gunTransformer = new gunTransformer();
    this._trackerErrorHandler = trackerErrorHandler;
    this._dimPlatformService = dimPlatformService;
    this._loadingTracker = loadingTracker;
  }

  getReviewer() {
    var membershipInfo = this._dimPlatformService.getActive();

    return {
      membershipId: membershipInfo.membershipId,
      type: membershipInfo.type,
      displayName: membershipInfo.id
    };
  }

  toRatingAndReview(userReview) {
    return {
      rating: userReview.rating,
      review: userReview.review,
      pros: userReview.pros,
      cons: userReview.cons
    };
  }

  submitItemReviewCall(itemReview) {
    return {
      method: 'POST',
      url: 'https://reviews-api.destinytracker.net/api/weaponChecker/reviews/submit',
      data: itemReview,
      dataType: 'json'
    };
  }

  submitReviewPromise(item, userReview) {
    var rollAndPerks = this._gunTransformer.getRollAndPerks(item);
    var reviewer = this.getReviewer();
    var review = this.toRatingAndReview(userReview);

    var rating = Object.assign(rollAndPerks, review);
    rating.reviewer = reviewer;

    var promise = this.$q
              .when(this.submitItemReviewCall(rating))
              .then(this.$http)
              .then(this._trackerErrorHandler.handleSubmitErrors, this._trackerErrorHandler.handleSubmitErrors);

    this._loadingTracker.addPromise(promise);

    return promise;
  }

  submitReview(item, userReview) {
    this.submitReviewPromise(item, userReview);
  }
}

function DestinyTrackerService($q,
                               $http,
                               $rootScope,
                               dimPlatformService,
                               dimSettingsService,
                               $translate,
                               dimFeatureFlags,
                               loadingTracker) {
  var _trackerErrorHandler = new trackerErrorHandler($q, $translate);
  var _bulkFetcher = new bulkFetcher($q, $http, _trackerErrorHandler, loadingTracker);
  var _reviewsFetcher = new reviewsFetcher($q, $http, _trackerErrorHandler, loadingTracker);
  var _reviewSubmitter = new reviewSubmitter($q, $http, dimPlatformService, _trackerErrorHandler, loadingTracker);
  var _postEnabled = dimFeatureFlags.sendingWeaponDataEnabled;

  function _userHasNotOkayedPostingIds() {
    return (!dimSettingsService.allowIdPostToDtr);
  }

  $rootScope.$on('item-clicked', function(event, item) {
    if ((!_postEnabled) ||
        (_userHasNotOkayedPostingIds())) {
      return;
    }

    _reviewsFetcher.getItemReviews(item);
  });

  $rootScope.$on('dim-stores-updated', function(event, stores) {
    if (!_postEnabled) {
      return;
    }

    _bulkFetcher.bulkFetch(stores);
  });

  $rootScope.$on('review-submitted', function(event, item, userReview) {
    if ((!_postEnabled) ||
        (_userHasNotOkayedPostingIds())) {
      return;
    }

    _reviewSubmitter.submitReview(item, userReview);
  });

  return {
    init: function() {}
  };
}