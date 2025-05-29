
<script setup lang="ts">

const asd = 1;
const message = "This component has a value: " + asd;

function double(value: number): number {
  return value * 2;
}
</script>

<template>
  <div class="p-4 my-4 bg-white rounded-lg shadow">
    <h2 class="text-xl font-bold text-red-600">Hello World from Plugin!</h2>
    <p class="text-red-500 mt-2">
      This is a simple plugin component with red text using Tailwind CSS.
    </p>

    <!-- Use the variable from script in the template -->
    <p class="mt-2 text-red-700 font-semibold">
      The value of asd is: {{ asd }}
    </p>

    <!-- Use the message variable -->
    <p class="mt-1 text-red-600">
      {{ message }}
    </p>

    <!-- Use the function -->
    <p class="mt-1 text-red-800">
      The doubled value is: {{ double(asd) }}
    </p>
  </div>
</template>
