<script lang="ts">
  export let picture: string;
  export let url: string;
  export let channelName: string;
</script>

<li class="outline">
  <img src={picture || "/default.png"} alt="" class="channel_icon" />
  <a href={`/channels/${url}`}>{channelName}</a>
</li>

<style>
  .outline {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    padding: 0px 20px;
  }
  .channel_icon {
    margin-right: 14px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    object-fit: cover;
    aspect-ratio: 1;
  }
</style>
