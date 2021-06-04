import { Renderer } from "@k8slens/extensions";
import React from "react";
import { PreferencesStore } from "./preferences-store";
import { PreferenceHint, PreferenceInput } from "./preferences"

export default class GkeRenderer extends Renderer.LensExtension {
  statusBarItems = [
    {
      item: (): JSX.Element => {
        const style = {"textDecoration": "none"};

        return (
          <a title="Open Google Cloud Console" href="https://console.cloud.google.com/kubernetes/list" target="_blank" className="flex align-center gaps hover-highlight" style={ style}>
            <Renderer.Component.Icon material="cloud_queue" /> <span className="flex gaps">GKE</span>
          </a>
        )
      }
    }
  ]

  appPreferences = [
    {
      title: "Google Kubernetes Engine",
      components: {
        Hint: (): JSX.Element => <PreferenceHint/>,
        Input: (): JSX.Element => <PreferenceInput/>
      }
    }
  ];

  async onActivate(): Promise<void> {
    await PreferencesStore.createInstance().loadExtension(this);
  }
}
