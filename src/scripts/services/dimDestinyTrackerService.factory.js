import angular from 'angular';
import _ from 'underscore';

angular.module('dimApp')
  .factory('dimDestinyTrackerService', DestinyTrackerService);

function DestinyTrackerService($q,
                               $http) {
    //todo: save/restore JWT from session storage
    var _remoteJwt = {};
    var _gunListBuilder = {};

    function getBulkWeaponData(gunList) {
      return {
        method: 'POST',
        url: 'https://reviews-api.destinytracker.net/api/weaponChecker/fetch',
        data: gunList,
        dataType: 'json'
      };
    }

    function handleErrors(response) {
        //DTR-specific handling goes here
    }

    return {
        init: function() {
            _gunListBuilder = gunListBuilder();
        },
        authenticate: function() {  
        },
        bulkFetch: function(membershipType, membershipId, stores) {
            var weaponList = _gunListBuilder.getWeaponList(stores);

            var promise = $q
                .when(getBulkWeaponData(weaponList))
                .then($http)
                .then(handleErrors, handleErrors)
                .then((response) => response.data.Response.data);

            return promise;
        }
    }
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
                            if(!item.primStat) {
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

            if(!_.contains(list, dtrGun)) {
                list.push(dtrGun);
            }
        });

        return list;        
    }

    function getGunRoll(gun) {
        if(!gun.talentGrid) {
            return null;
        }

        return gun.talentGrid.dtrPerks.replace(/o/g, "");
    }

    function translateToDtrGun(gun) {
        return { 
            referenceId: gun.hash,
            roll: getGunRoll(gun)
        };
    }

    function isKnownGun(list, dtrGun) {
        return _.contains(list, dtrGun);
    }

    return glb;
}