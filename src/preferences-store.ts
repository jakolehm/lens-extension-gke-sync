import { Store } from "@k8slens/extensions";
import { observable, toJS } from "mobx";

export type GkePreferencesModel = {
  gcloudPath?: string;
};

export class PreferencesStore extends Store.ExtensionStore<GkePreferencesModel> {

  @observable gcloudPath: string;

  private constructor() {
    super({
      configName: "preferences-store",
      defaults: {
        enabled: true
      }
    });
  }

  protected fromStore({ gcloudPath }: GkePreferencesModel): void {
    this.gcloudPath = gcloudPath;
  }

  toJSON(): GkePreferencesModel {
    return toJS({
      gcloudPath: this.gcloudPath
    }, {
      recurseEverything: true
    });
  }
}

export const preferencesStore = PreferencesStore.getInstance<PreferencesStore>();
