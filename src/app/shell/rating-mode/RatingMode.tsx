import * as React from 'react';
import { t } from 'i18next';
import './RatingMode.scss';
import ClickOutside from '../../dim-ui/ClickOutside';
import { settings } from '../../settings/settings';
import { $rootScope } from 'ngimport';
import { D2ManifestDefinitions, getDefinitions } from '../../destiny2/d2-definitions.service';
import { getReviewModes, D2ReviewMode } from '../../destinyTrackerApi/reviewModesFetcher';
import { D2StoresService } from '../../inventory/d2-stores.service';
import { DtrPlatformOption, getPlatformOptions } from '../../destinyTrackerApi/platformOptionsFetcher';

interface State {
  open: boolean;
  reviewsModeSelection: number;
  platformSelection: number;
  defs?: D2ManifestDefinitions;
}

// TODO: observe Settings changes - changes in the reviews pane aren't reflected here without an app refresh.
export default class RatingMode extends React.Component<{}, State> {
  private dropdownToggler = React.createRef<HTMLElement>();
  private _reviewModeOptions?: D2ReviewMode[];
  private _platformOptions?: DtrPlatformOption[];

  constructor(props) {
    super(props);
    this.state = { open: false,
      reviewsModeSelection: settings.reviewsModeSelection,
      platformSelection: settings.reviewsPlatformSelection };
  }

  componentDidMount() {
    getDefinitions().then((defs) => this.setState({ defs }));
  }

  render() {
    const { open, reviewsModeSelection, defs, platformSelection } = this.state;

    if (!defs) {
      return null;
    }

    return (
      <div>
          <span className="link" onClick={this.toggleDropdown} ref={this.dropdownToggler} title={t('DtrReview.ForGameMode')}>
            <i className='fa fa fa-thumbs-up'/>
          </span>
          {open &&
          <ClickOutside onClickOutside={this.closeDropdown}>
          <div className="mode-popup">
            <table>
              <tr>
                <td>
                  <label className="mode-label" htmlFor="reviewMode">{t('DtrReview.ForGameMode')}</label>
                </td>
                <td>
                  <select name="reviewMode" value={reviewsModeSelection} onChange={this.modeChange}>
                    {this.reviewModeOptions.map((r) => <option key={r.mode} value={r.mode}>{r.description}</option>)}
                  </select>
                </td>
              </tr>
              <tr>
                <td>
                  <label className="mode-label" htmlFor="reviewMode">{t('DtrReview.ForPlatform')}</label>
                </td>
                <td>
                  <select name="platformSelection" value={platformSelection} onChange={this.platformChange}>
                    {this.platformOptions.map((r) => <option key={r.description} value={r.platform}>{r.description}</option>)}
                  </select>
                </td>
              </tr>
            </table>
          </div>

          </ClickOutside>}
      </div>
    );
  }

  private get reviewModeOptions() {
    if (!this._reviewModeOptions) {
      this._reviewModeOptions = getReviewModes(this.state.defs);
    }
    return this._reviewModeOptions;
  }

  private get platformOptions() {
    if (!this._platformOptions) {
      this._platformOptions = getPlatformOptions();
    }

    return this._platformOptions;
  }

  private toggleDropdown = () => {
    this.setState({ open: !this.state.open });
  }

  private closeDropdown = (e?) => {
    if (!e || !this.dropdownToggler.current || !this.dropdownToggler.current.contains(e.target)) {
      this.setState({ open: false });
    }
  }

  private modeChange = (e?) => {
    if (!e || !e.target) {
      return;
    }

    const newModeSelection = e.target.value;
    settings.reviewsModeSelection = newModeSelection;
    D2StoresService.refreshRatingsData();
    this.setState({ reviewsModeSelection: newModeSelection });
    $rootScope.$broadcast('dim-refresh');
  }

  private platformChange = (e?) => {
    if (!e || !e.target) {
      return;
    }

    const newPlatformSelection = e.target.value;
    settings.reviewsPlatformSelection = newPlatformSelection;
    D2StoresService.refreshRatingsData();
    this.setState({ platformSelection: newPlatformSelection });
    $rootScope.$broadcast('dim-refresh');
  }
}
