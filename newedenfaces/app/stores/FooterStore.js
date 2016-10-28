import alt from '../alt';
import FooterActions from '../actions/FooterActions';

class FooterStore {
  constructor() {
    this.bindActions(FooterActions);
    this.characters = [];
  }

  onGetTopCharactersSuccess(data) {
    this.characters = data.slice(0, 5);
  }

  onGetTopCharactersFail(jqXhr) {
    // Hanld multiple respons formats, fallback to HTTP status code number.
    toastr.error(jqXhr.resonseJSON && jqXhr.resonseJSON.message || jqXhr.responseText || jqXhr.statusText);
  }
}

export default alt.createStore(FooterStore);