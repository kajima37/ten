# https://flake.parts/index.html

{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    systems.url = "github:nix-systems/default";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = import inputs.systems;
      perSystem =
        { pkgs, ... }:
        {
          # Development shell backed entirely by nixpkgs. Version management
          # is unified on pnpm 11: both nixpkgs (this shell) and mise.toml
          # (other platforms) pin the same pnpm 11 line.
          devShells.default = pkgs.mkShell {
            buildInputs =
              with pkgs;
              [
                nodejs_26
                pnpm

                # browser tests
                playwright-driver.browsers

                # secret management
                age
                sops

                # GitHub CLI
                gh

                # fundamental tools
                git
                curl
                jq
                fd
                ripgrep
                tree
                which
              ];

              PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
              PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
            };
        };
    };
}
