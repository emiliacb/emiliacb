{
  description = "landing dev shell";

  # ponytail: channel tarball instead of github:NixOS/nixpkgs — same pinning via
  # flake.lock, no api.github.com rate limit. Switch to github: if you need a
  # specific commit.
  inputs.nixpkgs.url = "https://channels.nixos.org/nixos-25.05/nixexprs.tar.xz";

  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
      forAll = f: nixpkgs.lib.genAttrs systems (s: f nixpkgs.legacyPackages.${s});
    in
    {
      devShells = forAll (pkgs: {
        default = pkgs.mkShell {
          packages = [ pkgs.nodejs_20 ];
        };
      });
    };
}
