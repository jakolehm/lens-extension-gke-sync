import { Common, Renderer } from "@k8slens/extensions";
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
            <span className="flex gaps">GKE</span>
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

    const category = Renderer.Catalog.catalogCategories.getForGroupKind("entity.k8slens.dev", "KubernetesCluster");

    if (!category) {
      return;
    }

    category.on("contextMenuOpen", this.clusterContextMenuOpen.bind(this));
  }

  async clusterContextMenuOpen(cluster: Common.Catalog.CatalogEntity, ctx: Common.Catalog.CatalogEntityContextMenuContext): Promise<void> {
    if(!(cluster instanceof Common.Catalog.KubernetesCluster)) return;

    if (cluster.metadata.source === "gke-sync") {
      ctx.menuItems.unshift({
        title: "Settings",
        onClick: async () => ctx.navigate(`/entity/${cluster.metadata.uid}/settings`)
      });
    }
  }
}
