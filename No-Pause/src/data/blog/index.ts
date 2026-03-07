import type { BlogPost } from './types';
import { whyPausesHurtFluencyPost } from './why-pauses-hurt-fluency';
import { whatCausesHesitationPost } from './what-causes-hesitation';
import { whyDoISayUmAndUhPost } from './why-do-i-say-um-and-uh';
import { isFluencySpeedOrSmoothnessPost } from './is-fluency-speed-or-smoothness';
import { howManyPausesAreTooManyPost } from './how-many-pauses-are-too-many';
import { whatDoesFlowScoreMeasurePost } from './what-does-flow-score-measure';
import { howIsFlowScoreCalculatedPost } from './how-is-flow-score-calculated';
import { whatIsAGoodFlowScorePost } from './what-is-a-good-flow-score';
import { whyDidMyFlowScoreDropPost } from './why-did-my-flow-score-drop';
import { isFlowScoreBetterThanWpmPost } from './is-flow-score-better-than-wpm';
import { howToReduceFillerWordsFastPost } from './how-to-reduce-filler-words-fast';
import { howToPracticeSpeakingAlonePost } from './how-to-practice-speaking-alone';
import { doesRecordingImproveFluencyPost } from './does-recording-improve-fluency';
import { howLongShouldIPracticeSpeakingPost } from './how-long-should-i-practice-speaking';
import { canReadingAloudImproveFlowPost } from './can-reading-aloud-improve-flow';
import { whyDoIPauseWhenNervousPost } from './why-do-i-pause-when-nervous';
import { whyDoIForgetWordsMidSentencePost } from './why-do-i-forget-words-mid-sentence';
import { doesAnxietyIncreaseFillerWordsPost } from './does-anxiety-increase-filler-words';
import { howToSpeakFluentlyInInterviewsPost } from './how-to-speak-fluently-in-interviews';
import { howToStopFreezingInPresentationsPost } from './how-to-stop-freezing-in-presentations';

const allBlogPosts: BlogPost[] = [
  whyPausesHurtFluencyPost,
  whatCausesHesitationPost,
  whyDoISayUmAndUhPost,
  isFluencySpeedOrSmoothnessPost,
  howManyPausesAreTooManyPost,
  whatDoesFlowScoreMeasurePost,
  howIsFlowScoreCalculatedPost,
  whatIsAGoodFlowScorePost,
  whyDidMyFlowScoreDropPost,
  isFlowScoreBetterThanWpmPost,
  howToReduceFillerWordsFastPost,
  howToPracticeSpeakingAlonePost,
  doesRecordingImproveFluencyPost,
  howLongShouldIPracticeSpeakingPost,
  canReadingAloudImproveFlowPost,
  whyDoIPauseWhenNervousPost,
  whyDoIForgetWordsMidSentencePost,
  doesAnxietyIncreaseFillerWordsPost,
  howToSpeakFluentlyInInterviewsPost,
  howToStopFreezingInPresentationsPost,
];

export const blogPosts: BlogPost[] = allBlogPosts
  .filter((post) => !post.draft)
  .sort((a, b) => b.date.localeCompare(a.date));

export const getBlogPostBySlug = (slug: string): BlogPost | undefined =>
  blogPosts.find((post) => post.slug === slug);
