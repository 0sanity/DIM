import angular from 'angular';

angular.module('dimApp')
  .directive('dimItemDiscuss', ItemDiscuss);

function ItemDiscuss() {
  return {
    controller: ItemDiscussCtrl,
    controllerAs: 'vm',
    bindToController: true,
    scope: {},
    templateUrl: require('./dimItemDiscuss.directive.template.html')
  };
}

function ItemDiscussCtrl($scope, $rootScope, toaster, dimItemDiscussService, dimItemService, dimFeatureFlags, dimDestinyTrackerService) {
  var vm = this;
  vm.featureFlags = dimFeatureFlags;
  vm.show = dimItemDiscussService.dialogOpen;
  vm.dtrRatingOptions = [1, 2, 3, 4, 5];

  $rootScope.$on('dim-store-item-discuss', function(event, item) {
    vm.show = true;

    vm.item = item.item;
  });

  vm.cancel = function cancel() {
    vm.loadout = angular.copy(vm.defaults);
    dimItemDiscussService.dialogOpen = false;
    vm.show = false;
  };

  vm.submitReview = function submitReview() {
    var item = vm.item;
    var userReview = vm.toUserReview(item);

    $rootScope.$broadcast('review-submitted', item, userReview);

    return false;
  };

  vm.toUserReview = function(item) {
    var newRating = item.userRating;
    var review = item.userReview;
    var pros = item.userReviewPros;
    var cons = item.userReviewCons;

    var userReview = {
      rating: newRating,
      review: review,
      pros: pros,
      cons: cons
    };

    return userReview;
  };

  vm.reviewBlur = function() {
    var item = vm.item;
    var userReview = vm.toUserReview(item);

    dimDestinyTrackerService.updateUserRankings(item,
                                                userReview);
  };
}