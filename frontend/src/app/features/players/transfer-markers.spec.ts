import { TestBed } from '@angular/core/testing';

import { appConfig } from '../../app.config';
import { PlayerTransfer } from './models/player.model';
import { buildTransferSeries, describeTransfer } from './transfer-markers';

describe('transfer markers', () => {
  const ol = { id: 'c1', name: 'Olympique Lyonnais' };
  const arsenal = { id: 'c2', name: 'Arsenal FC' };
  const marketValues = [
    { value: 10000000, date: '2016-06-01T00:00:00.000Z' },
    { value: 40000000, date: '2017-06-01T00:00:00.000Z' },
    { value: 50000000, date: '2018-01-01T00:00:00.000Z' }
  ];

  beforeEach(() => {
    // Registers the fr-FR locale data
    TestBed.configureTestingModule({ providers: appConfig.providers });
  });

  describe('describeTransfer', () => {
    it('describes a paid transfer between two clubs', () => {
      const transfer: PlayerTransfer = { date: '2017-07-05T00:00:00.000Z', fromClub: ol, toClub: arsenal, fee: 53000000 };

      expect(describeTransfer(transfer, 'fr-FR')).toBe(
        "Transfert du 5 juillet 2017 d'Olympique Lyonnais vers Arsenal FC pour 53 000 000 €."
      );
    });

    it('describes a free transfer and an unknown fee', () => {
      expect(
        describeTransfer({ date: '2022-07-01T00:00:00.000Z', fromClub: arsenal, toClub: ol, fee: 0 }, 'fr-FR')
      ).toBe("Transfert du 1er juillet 2022 d'Arsenal FC vers Olympique Lyonnais, sans indemnité de transfert.");
      expect(describeTransfer({ date: '2010-07-01T00:00:00.000Z', fromClub: null, toClub: ol, fee: null }, 'fr-FR')).toBe(
        'Transfert du 1er juillet 2010 vers Olympique Lyonnais, montant non communiqué.'
      );
    });
  });

  describe('buildTransferSeries', () => {
    it('puts each transfer on the closest valuation', () => {
      const series = buildTransferSeries(
        marketValues,
        [{ date: '2017-07-05T00:00:00.000Z', fromClub: ol, toClub: arsenal, fee: 53000000 }],
        'fr-FR'
      );

      expect(series.label).toBe('Transferts');
      expect(series.showLine).toBeFalse();
      expect(series.data).toEqual([null, 40000000, null]);
      expect(series.pointLabels?.[1]).toContain('Transfert du 5 juillet 2017');
    });

    it('leaves out transfers outside the valuation history', () => {
      const series = buildTransferSeries(
        marketValues,
        [
          { date: '2010-07-01T00:00:00.000Z', fromClub: null, toClub: ol, fee: null },
          { date: '2022-07-01T00:00:00.000Z', fromClub: arsenal, toClub: ol, fee: 0 }
        ],
        'fr-FR'
      );

      expect(series.data).toEqual([null, null, null]);
      expect(buildTransferSeries([], [{ date: '2010-07-01', fromClub: null, toClub: ol, fee: null }], 'fr-FR').data).toEqual([]);
    });

    it('joins transfers that land on the same valuation', () => {
      const series = buildTransferSeries(
        marketValues,
        [
          { date: '2016-06-02T00:00:00.000Z', fromClub: null, toClub: ol, fee: null },
          { date: '2016-06-20T00:00:00.000Z', fromClub: ol, toClub: arsenal, fee: 1000000 }
        ],
        'fr-FR'
      );

      expect(series.data).toEqual([10000000, null, null]);
      expect(series.pointLabels?.[0]).toBe(
        'Transfert du 2 juin 2016 vers Olympique Lyonnais, montant non communiqué. ' +
          "Transfert du 20 juin 2016 d'Olympique Lyonnais vers Arsenal FC pour 1 000 000 €."
      );
    });
  });
});
