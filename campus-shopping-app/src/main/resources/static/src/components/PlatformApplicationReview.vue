<script setup lang="ts">
import { applicationStatusLabel } from '../services/page-utils.js';

interface Application {
  applicationId: string;
  merchantName: string;
  status: string;
  contactName: string;
  contactPhone: string;
  storeName: string;
  location: string;
  rejectionReason?: string | null;
}

defineProps<{
  application: Application;
  reason: string;
  disabled: boolean;
}>();
defineEmits<{
  'update:reason': [reason: string];
  review: [approved: boolean];
}>();
</script>

<template>
  <aside class="ops-card ops-sideform">
    <h2>{{ application.merchantName }}</h2>
    <span class="status-tag">{{ applicationStatusLabel(application.status) }}</span>
    <div class="inspector-row">
      <span>申请编号</span><strong>{{ application.applicationId }}</strong>
    </div>
    <div class="inspector-row">
      <span>联系人</span><strong>{{ application.contactName }}</strong>
    </div>
    <div class="inspector-row">
      <span>联系电话</span><strong>{{ application.contactPhone }}</strong>
    </div>
    <div class="inspector-row">
      <span>门店</span><strong>{{ application.storeName }}</strong>
    </div>
    <div class="inspector-row">
      <span>位置</span><strong>{{ application.location }}</strong>
    </div>
    <div v-if="application.rejectionReason" class="inline-error">
      {{ application.rejectionReason }}
    </div>
    <template v-if="application.status === 'SUBMITTED'">
      <label class="field-label" for="platform-field-1">审核意见</label>
      <textarea
        id="platform-field-1"
        class="admin-input"
        :value="reason"
        rows="3"
        maxlength="500"
        placeholder="拒绝时必须填写原因"
        @input="$emit('update:reason', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <div class="form-buttons">
        <button
          class="outline-button"
          :disabled="disabled || !reason.trim()"
          @click="$emit('review', false)"
        >
          驳回
        </button>
        <button class="teal-button" :disabled="disabled" @click="$emit('review', true)">
          通过审核
        </button>
      </div>
    </template>
  </aside>
</template>
