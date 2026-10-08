export interface SiteConfig {
  name: string;
  heading: string;
  intro: string;
  metaDescription: string;
  portfolio: string;
  repo: string;
  footer: string;
}

export const siteConfig: SiteConfig = {
  name: "zingdev",
  heading: "welcome",
  intro:
    "The diagram here is a representation of the infrastructure I run all of my side projects on. It is a self managed k3s cluster running on 5 Hetzner Cloud VMs. It is bootstrapped through IAC and most of the Kubernetes infrastructure is managed via FluxCD. Go ahead, click and drag around.",
  metaDescription: "Read about my lab infrastructure - zing",
  portfolio: "https://zingdev.xyz",
  repo: "https://github.com/zing-rsa/lab-web",
  footer: "Built and broken repeatedly, for fun.",
};
