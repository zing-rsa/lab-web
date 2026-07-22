export interface SiteConfig {
  name: string;
  heading: string;
  intro: string;
  /** Link back to the main portfolio site. */
  portfolio: string;
  /** Public repo for the lab GitOps config. */
  repo: string;
  footer: string;
}

export const siteConfig: SiteConfig = {
  name: "zingdev",
  heading: "~/lab",
  intro:
    "A GitOps-managed Kubernetes cluster I run on bare Hetzner Cloud — provisioned with Terraform, reconciled by Flux, and fronted by the Gateway API. Everything below is declared in Git: the networking edge, the platform operators, the observability stack, and the data layer. Explore the components in the diagram.",
  portfolio: "https://zingdev.xyz",
  repo: "https://github.com/zing-rsa/lab",
  footer: "Built and broken repeatedly, for fun.",
};
