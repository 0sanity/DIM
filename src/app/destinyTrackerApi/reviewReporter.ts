import { $q, $http } from 'ngimport';
import { TrackerErrorHandler } from './trackerErrorHandler';
import { ReviewDataCache } from './reviewDataCache';
import { D1ItemUserReview } from '../item-review/destiny-tracker.service';
import { DestinyAccount } from '../accounts/destiny-account.service';

/**
 * Class to support reporting bad takes.
 */
export class ReviewReporter {
  _userFilter: any;
  _reviewDataCache: ReviewDataCache;
  _loadingTracker: any;
  _trackerErrorHandler: TrackerErrorHandler;
  constructor(loadingTracker, reviewDataCache, userFilter) {
    this._trackerErrorHandler = new TrackerErrorHandler();
    this._loadingTracker = loadingTracker;
    this._reviewDataCache = reviewDataCache;
    this._userFilter = userFilter;
  }

  _getReporter(membershipInfo: DestinyAccount) {
    return {
      membershipId: membershipInfo.membershipId,
      membershipType: membershipInfo.platformType,
      displayName: membershipInfo.displayName
    };
  }

  _submitReviewReportCall(reviewReport) {
    return {
      method: 'POST',
      url: 'https://reviews-api.destinytracker.net/api/weaponChecker/reviews/report',
      data: reviewReport,
      dataType: 'json'
    };
  }

  _generateReviewReport(reviewId, membershipInfo: DestinyAccount) {
    const reporter = this._getReporter(membershipInfo);

    return {
      reviewId: reviewId,
      report: "",
      reporter: reporter
    };
  }

  _submitReportReviewPromise(reviewId, membershipInfo) {
    const reviewReport = this._generateReviewReport(reviewId, membershipInfo);

    const promise = $q
              .when(this._submitReviewReportCall(reviewReport))
              .then($http)
              .then(this._trackerErrorHandler.handleSubmitErrors.bind(this._trackerErrorHandler), this._trackerErrorHandler.handleSubmitErrors.bind(this._trackerErrorHandler));

    this._loadingTracker.addPromise(promise);

    return promise;
  }

  _ignoreReportedUser(review) {
    const reportedMembershipId = review.reviewer.membershipId;
    this._userFilter.ignoreUser(reportedMembershipId);
  }

  /**
   * Report a written review.
   * Also quietly adds the associated user to a block list.
   */
  reportReview(review: D1ItemUserReview, membershipInfo: DestinyAccount) {
    if (review.isHighlighted || review.isReviewer) {
      return;
    }

    this._submitReportReviewPromise(review.reviewId, membershipInfo)
      .then(this._reviewDataCache.markReviewAsIgnored(review))
      .then(this._ignoreReportedUser(review));
  }
}
