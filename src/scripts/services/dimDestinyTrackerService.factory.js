import angular from 'angular';
import _ from 'underscore';
import { gunTransformer } from '../destinyTrackerApi/gunTransformer.js';
import { reviewDataCache } from '../destinyTrackerApi/reviewDataCache.js';
import { trackerErrorHandler } from '../destinyTrackerApi/trackerErrorHandler.js';
import { bulkFetcher } from '../destinyTrackerApi/bulkFetcher.js';

angular.module('dimApp')
  .factory('dimDestinyTrackerService', DestinyTrackerService);

class reviewsFetcher {
  constructor($q, $http, trackerErrorHandler, loadingTracker, scoreMaintainer) {
    this.$q = $q;
    this.$http = $http;
    this._gunTransformer = new gunTransformer();
    this._trackerErrorHandler = trackerErrorHandler;
    this._loadingTracker = loadingTracker;
    this._reviewDataCache = scoreMaintainer;
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

    this._reviewDataCache.addReviewsData(item,
                                         reviewData);
  }

  attachCachedReviews(item,
                      cachedItem) {
    item.communityReviews = cachedItem.reviews;

    this.attachReviews(item,
                       cachedItem);

    if (cachedItem.userRating) {
      item.userRating = cachedItem.userRating;
    }

    if (cachedItem.review) {
      item.userReview = cachedItem.review;
    }

    if (cachedItem.pros) {
      item.userReviewPros = cachedItem.pros;
    }

    if (cachedItem.cons) {
      item.userReviewCons = cachedItem.cons;
    }
  }

  getItemReviews(item) {
    var ratingData = this._reviewDataCache.getRatingData(item);

    if (ratingData.reviewsDataFetched) {
      this.attachCachedReviews(item,
                               ratingData);

      return;
    }

    this.getItemReviewsPromise(item)
      .then((data) => this.attachReviews(item,
                                         data));
  }
}

class reviewSubmitter {
  constructor($q, $http, dimPlatformService, trackerErrorHandler, loadingTracker, scoreMaintainer) {
    this.$q = $q;
    this.$http = $http;
    this._gunTransformer = new gunTransformer();
    this._trackerErrorHandler = trackerErrorHandler;
    this._dimPlatformService = dimPlatformService;
    this._loadingTracker = loadingTracker;
    this._reviewDataCache = scoreMaintainer;
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

  eventuallyPurgeCachedData(item) {
    this._reviewDataCache.eventuallyPurgeCachedData(item);
  }

  submitReview(item, userReview) {
    this.submitReviewPromise(item, userReview)
      .then(this.eventuallyPurgeCachedData(item));
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
  var _reviewDataCache = new reviewDataCache();
  var _trackerErrorHandler = new trackerErrorHandler($q, $translate);
  var _bulkFetcher = new bulkFetcher($q, $http, _trackerErrorHandler, loadingTracker, _reviewDataCache);
  var _reviewsFetcher = new reviewsFetcher($q, $http, _trackerErrorHandler, loadingTracker, _reviewDataCache);
  var _reviewSubmitter = new reviewSubmitter($q, $http, dimPlatformService, _trackerErrorHandler, loadingTracker, _reviewDataCache);
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
    init: function() {},
    reattachScores: function(stores) {
      _bulkFetcher.attachRankings(null,
                                  stores);
    },
    updateUserRankings: function(item,
                                 userReview) {
      _reviewDataCache.addUserReviewData(item,
                                         userReview);
    }
  };
}