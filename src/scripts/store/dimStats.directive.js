import angular from 'angular';
import template from './dimStats.directive.html';

angular.module('dimApp')
  .directive('dimStats', Stats);


function Stats() {
  return {
    controller: StatsCtrl,
    controllerAs: 'vm',
    bindToController: true,
    scope: {
      stats: '<'
    },
    template: template
  };
}


function StatsCtrl($scope, $translate) {
  const vm = this;

  $scope.$watch('vm.stats', () => {
    if (!vm.stats) {
      vm.statList = [];
      return;
    }

    vm.statList = [vm.stats.STAT_INTELLECT, vm.stats.STAT_DISCIPLINE, vm.stats.STAT_STRENGTH];
    vm.statList.forEach((stat) => {
      // compute tooltip
      const tier = stat.tier;
      const next = $translate.instant('Stats.TierProgress', { progress: tier === 5 ? stat.value : (stat.value % 60), tier: tier, nextTier: tier + 1, statName: stat.name });
      let cooldown = stat.cooldown || '';
      if (cooldown) {
        cooldown = $translate.instant(`Cooldown.${stat.effect}`, { cooldown: cooldown });
      }
      stat.tooltip = next + cooldown;
    });
  });
}
