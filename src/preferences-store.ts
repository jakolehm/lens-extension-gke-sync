import { Common } from "@k8slens/extensions";
import { makeObservable, observable, toJS } from "mobx";

export type GkePreferencesModel = {
  gcloudPath?: string;
};

export class PreferencesStore extends Common.Store.ExtensionStore<GkePreferencesModel> {
  @observable gcloudPath: string;

  public constructor() {
    super({
      configName: "preferences-store"
    });

    makeObservable(this);
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
