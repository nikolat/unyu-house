<script lang="ts">
  export let picture: string;
  export let url: string;
  export let channelName: string;
  export let post_count: number;
  export let fav_count: number;
  export let classname: string;
</script>

<li class="outline {classname}">
  <img src={picture || "/default.png"} alt="" class="channel_icon {classname}" />
  <a href={`/channels/${url}`}>{channelName}</a>
  {#if post_count > 0}📜{post_count}{/if}
  {#if fav_count > 0}❤{fav_count}{/if}
</li>

<style>
  .outline {
    display: flex;
    align-items: center;
    padding: 0px 20px;
  }
  .channel_icon {
    margin-right: 14px;
    border-radius: 10%;
    overflow: hidden;
    object-fit: cover;
    aspect-ratio: 1;
  }
  li.pinned {
    margin-bottom: 12px;
  }
  img.pinned {
    width: 32px;
    height: 32px;
  }
  img.all {
    width: 16px;
    height: 16px;
  }
</style>
