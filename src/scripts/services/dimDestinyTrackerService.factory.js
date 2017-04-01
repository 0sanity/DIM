import angular from 'angular';
import _ from 'underscore';

angular.module('dimApp')
  .factory('dimDestinyTrackerService', DestinyTrackerService);

function DestinyTrackerService($q,
                               $http,
                               $rootScope) {
  var _gunListBuilder = gunListBuilder();

  $rootScope.$on('item-clicked', function(event, item) {
    console.log("Caught click event.");
  });

  $rootScope.$on('dim-stores-updated', function(event, stores) {
    _bulkFetch(stores)
      .then((bulkRankings) => attachRankings(bulkRankings,
                                             stores.stores));
  });

  function attachRankings(bulkRankings,
                          stores) {
    if ((!bulkRankings) ||
        (!bulkRankings.length)) {
      return;
    }

    bulkRankings.forEach(function(bulkRanking) {
      stores.forEach(function(store) {
        store.items.forEach(function(storeItem) {
          if (storeItem.hash == bulkRanking.referenceId) {
            storeItem.dtrRating = bulkRanking.rating;
          }
        });
      });
    });
  }

  function getBulkWeaponDataPromise(gunList) {
    return {
      method: 'POST',
      url: 'https://reviews-api.destinytracker.net/api/weaponChecker/fetch',
      data: gunList,
      dataType: 'json'
    };
  }

  function submitItemReviewPromise(itemReview) {
    return {
      method: 'POST',
      url: 'https://reviews-api.destinytracker.net/api/weaponChecker/reviews/submit',
      data: itemReview,
      dataType: 'json'
    };
  }

  function handleErrors(response) {
    if (response.status !== 200) {
      return $q.reject(new Error("Destiny tracker service call failed."));
    }

    return response;
  }

  function handleSubmitErrors(response) {
    if (response.status !== 204) {
      return $q.reject(new Error("Destiny tracker service submit failed."));
    }

    return response;
  }

  function toReviewer(membershipInfo) {
    return {
      membershipId: membershipInfo.membershipId,
      type: membershipInfo.type,
      displayName: membershipInfo.id
    };
  }

  function toRatingAndReview(userReview) {
    return {
      rating: userReview.rating,
      review: userReview.review
    };
  }

  function _bulkFetch(stores) {
    if (stores.stores.length === 0) {
      return $q.resolve();
    }
    var weaponList = _gunListBuilder.getWeaponList(stores.stores);

    var promise = $q
              .when(getBulkWeaponDataPromise(weaponList))
              .then($http)
              .then(handleErrors, handleErrors)
              .then((response) => { return response.data; });

    return promise;
  }

  return {
    authenticate: function() {
    },
    bulkFetch: function(stores) {
      return _bulkFetch(stores);
    },
    submitReview: function(membershipInfo, item, userReview) {
      var rollAndPerks = _gunListBuilder.getRollAndPerks(item);
      var reviewer = toReviewer(membershipInfo);
      var review = toRatingAndReview(userReview);

      var rating = Object.assign(rollAndPerks, review);
      rating.reviewer = reviewer;

      var promise = $q
                .when(submitItemReviewPromise(rating))
                .then($http)
                .then(handleSubmitErrors, handleSubmitErrors)
                .then((response) => { return; });

      return promise;
    }
  };
}

function gunListBuilder() {
  var glb = {};

  function getAllItems(stores) {
    var allItems = [];

    stores.forEach(function(store) {
      allItems = allItems.concat(store.items);
    });

    return allItems;
  }

  function getGuns(stores) {
    var allItems = getAllItems(stores);

    return _.filter(allItems,
                        function(item) {
                          if (!item.primStat) {
                            return false;
                          }

                          return (item.primStat.statHash === 368428387);
                        });
  }

  glb.getWeaponList = function(stores) {
    var guns = getGuns(stores);

    var list = [];

    guns.forEach(function(gun) {
      var dtrGun = translateToDtrGun(gun);

      if (!isKnownGun(list, dtrGun)) {
        list.push(dtrGun);
      }
    });

    return list;
  };

  function getDtrPerks(gun) {
    if (!gun.talentGrid) {
      return null;
    }

    return gun.talentGrid.dtrPerks;
  }

  function getGunRoll(gun) {
    var dtrPerks = getDtrPerks(gun);

    if (dtrPerks.length > 0) {
      return dtrPerks.replace(/o/g, "");
    }

    return null;
  }

  function translateToDtrGun(gun) {
    return {
      referenceId: gun.hash,
      roll: getGunRoll(gun)
    };
  }

  glb.getRollAndPerks = function(gun) {
    return {
      roll: getGunRoll(gun),
      selectedPerks: getDtrPerks(gun),
      referenceId: gun.hash,
      instanceId: gun.id,
    };
  };

  function isKnownGun(list, dtrGun) {
    return _.contains(list, dtrGun);
  }

  return glb;
}