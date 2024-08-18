import { Context } from "hono";
import { html } from "hono/html";

import layout from "../../components/layout";

export default async function handler(c: Context) {
  const siteData = {
    title: "about | emiliacb",
  };

  const content = html`<p>about</p>
    <p class="py-16">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur sodales
      odio vitae ipsum tempus egestas. Etiam suscipit eget magna vel pulvinar.
      Phasellus convallis erat a turpis lobortis, ut mollis mi accumsan. Etiam
      libero lectus, aliquet id iaculis id, sollicitudin a sem. Sed aliquam
      rutrum ex ac maximus. In hac habitasse platea dictumst. Vivamus laoreet
      pulvinar lacus, rutrum pretium elit elementum quis. Suspendisse eget magna
      ipsum. Nulla interdum eros quam, ut tempus eros fringilla in. Aliquam nec
      volutpat ipsum. In viverra elit nec mi aliquam pretium. Nunc at
      scelerisque leo. Sed imperdiet dui in blandit accumsan. Aenean a magna
      orci. Donec ante lacus, rutrum eget leo quis, blandit tincidunt quam. Sed
      non tellus ex. Curabitur pellentesque neque at ligula ullamcorper
      accumsan. Donec pulvinar lorem ac gravida sodales. Nullam lobortis
      sollicitudin porttitor. Nulla a placerat velit. Etiam fermentum urna orci,
      vestibulum tristique sapien molestie id. In id commodo dolor. Cras vel
      auctor dolor. Praesent massa lectus, pretium interdum rhoncus nec, commodo
      a dolor. Proin lacinia mauris ac dolor tincidunt, euismod interdum nunc
      ultricies. Fusce vel iaculis augue. Nam venenatis aliquet convallis. Etiam
      consectetur accumsan risus, et accumsan nisl tempor quis. Fusce vel
      pulvinar enim, nec lobortis leo. Donec in velit iaculis, luctus purus sed,
      scelerisque est. Pellentesque quis tempus mauris. In semper mi nulla, sed
      gravida nunc efficitur et. Ut eget ligula at purus pharetra interdum ac a
      lectus. Integer a vulputate purus. Donec eu volutpat ligula. Praesent
      pulvinar orci magna, ut pulvinar sem ultricies eget. Integer id convallis
      orci. Ut gravida erat eu laoreet bibendum. Etiam a euismod nisl, a congue
      purus. Ut quis ultricies magna. Proin efficitur sodales fringilla. Etiam
      erat ante, gravida ac pretium non, posuere eget dolor. Pellentesque
      habitant morbi tristique senectus et netus et malesuada fames ac turpis
      egestas. Sed malesuada volutpat orci vel laoreet. Fusce eleifend tortor
      tellus, in porta augue semper id. Phasellus vulputate sapien a mi
      porttitor, vitae tincidunt risus vulputate. Quisque convallis velit dolor,
      eget cursus dui viverra id. Praesent pharetra nisl felis, non condimentum
      leo accumsan id. Fusce sed augue in nisl hendrerit rutrum. Nulla sit amet
      pretium ex. Sed porta diam laoreet neque rhoncus pretium. Class aptent
      taciti sociosqu ad litora torquent per conubia nostra, per inceptos
      himenaeos. Cras ultricies felis fringilla feugiat euismod. Nunc euismod
      nibh sed tortor vehicula volutpat. Curabitur molestie ligula porttitor
      diam mattis bibendum. Aenean magna nulla, molestie nec interdum a,
      pulvinar non enim. Sed metus arcu, auctor a vehicula vel, mattis nec orci.
      Aenean iaculis ullamcorper ipsum eu sollicitudin. Donec elementum odio
      ante, in tristique tellus consectetur eget. Nunc mi est, fermentum in
      tristique ut, vulputate at nulla. Nam mattis lorem vel vestibulum
      facilisis. Proin tristique laoreet turpis sed dignissim. Nullam hendrerit
      eros in massa commodo malesuada. Aliquam dapibus massa velit, elementum
      fringilla dolor placerat sit amet. Curabitur mattis neque vitae augue
      dignissim volutpat. Quisque sit amet efficitur dolor, vel molestie libero.
      Donec turpis arcu, auctor a finibus at, cursus non massa. Donec ut
      porttitor leo. Suspendisse mattis felis semper ante fermentum, in
      convallis diam lobortis. Curabitur vestibulum, metus vel euismod lobortis,
      tortor neque vehicula arcu, sed egestas sapien leo eget metus. Sed non
      rutrum velit. Aliquam erat volutpat. Suspendisse semper dolor et massa
      porta mattis. Morbi ac finibus nisl, nec laoreet augue. Duis eu est
      dictum, gravida lacus et, tempor felis. Pellentesque consequat, metus sed
      tempus finibus, est felis finibus lorem, in placerat tellus tortor ac
      justo. Duis pharetra ipsum quis mattis dignissim. Pellentesque interdum
      convallis est, nec scelerisque leo dapibus maximus. Nam quis lorem dictum,
      fringilla dolor id, consequat metus. Curabitur nec ex non nisi vehicula
      malesuada. Donec vel fermentum lorem. Suspendisse ut arcu at tellus tempor
      elementum. Mauris velit dolor, rutrum a mi id, accumsan laoreet sapien.
      Nunc tristique metus eget erat commodo, tincidunt fermentum purus maximus.
      Morbi auctor sapien augue. Nunc eu cursus velit, eu tincidunt est. Donec
      accumsan aliquam viverra. Suspendisse vitae dolor id turpis feugiat
      scelerisque. Vivamus augue diam, tempor gravida sem sit amet, finibus
      ullamcorper velit. Class aptent taciti sociosqu ad litora torquent per
      conubia nostra, per inceptos himenaeos. Duis eu laoreet libero, eget
      pharetra lectus. Sed eros mauris, dapibus feugiat nunc ac, hendrerit
      lobortis orci. Nulla est sem, vulputate ac ipsum ut, ultricies luctus
      sapien. Mauris consequat, quam at rhoncus vestibulum, quam tellus auctor
      lacus, non fringilla magna erat et odio. Sed commodo dictum arcu, vitae
      accumsan urna. Nunc aliquet erat ex, non porta risus vestibulum ac. In a
      eros eu quam pharetra fermentum. Integer ac felis magna. Praesent
      consequat libero scelerisque enim blandit, nec ullamcorper mi scelerisque.
      Phasellus placerat aliquam risus vel ornare. Ut purus est, mattis at
      fermentum sed, consectetur sed dui. Vestibulum eget molestie nunc.
      Maecenas mattis lectus vel dui laoreet commodo. Donec dui arcu, lobortis
      ut nibh non, sagittis auctor ipsum. Aliquam vitae vestibulum erat.
      Vestibulum pulvinar diam at lorem volutpat congue. Suspendisse non euismod
      neque. Phasellus vel tincidunt odio. Duis suscipit nisi sodales, tempor
      mauris sit amet, pellentesque tellus. Orci varius natoque penatibus et
      magnis dis parturient montes, nascetur ridiculus mus. Etiam velit lectus,
      rhoncus id rhoncus nec, ornare eget ipsum. Proin condimentum dapibus est,
      non sodales risus accumsan molestie. Nulla lobortis at lacus eu bibendum.
      Integer sed vulputate turpis, ac condimentum enim. Morbi purus nulla,
      aliquam egestas ante quis, imperdiet pretium arcu.
    </p>`;
  const view = layout({ siteData, children: content });

  return c.html(view);
}
