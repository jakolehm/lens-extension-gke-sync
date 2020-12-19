import { Component } from "@k8slens/extensions";
import React from "react";
import { observer } from "mobx-react";
import { PreferencesStore } from "./preferences-store";

@observer
export class PreferenceInput extends React.Component<{preferences: PreferencesStore}> {
  render(): JSX.Element {
    const { preferences } = this.props;

    return (
      <>
        <div className="SubTitle">Path to gcloud binary</div>
        <Component.Input
          value={preferences.gcloudPath}
          theme="round-black"
          placeholder="gcloud"
          onChange={v => { preferences.gcloudPath = v; }}
        />
      </>
    );
  }
}

export class PreferenceHint extends React.Component {
  render(): JSX.Element {
    return (
      <small className="hint">The path to the gcloud binary on the system.</small>
    );
  }
}
