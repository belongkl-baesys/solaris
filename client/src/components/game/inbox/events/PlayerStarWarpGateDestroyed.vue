<template>
<div v-if="star">
  <p>
      The warp gate at <a href="javascript:;" @click="onOpenStarDetailRequested">{{star.name}}</a> has been destroyed.
  </p>
</div>
</template>

<script>
import GameHelper from '../../../../services/gameHelper'

export default {
  components: {

  },
  props: {
    event: Object
  },
  data () {
    return {
      star: null
    }
  },
  mounted () {
    this.star = GameHelper.getStarById(this.$store.state.game, this.event.data.starId)
  },
  methods: {
    onOpenStarDetailRequested (e) {
      this.$emit('onOpenStarDetailRequested', this.star._id)
    }
  }
}
</script>

<style scoped>
</style>
