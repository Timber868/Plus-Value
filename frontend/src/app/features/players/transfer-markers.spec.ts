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
        "Transfert du 5 juillet 2017 de l’Olympique Lyonnais vers Arsenal FC pour 53 000 000 €."
      );
    });

    it('describes a free transfer and an unknown fee', () => {
      expect(
        describeTransfer({ date: '2022-07-01T00:00:00.000Z', fromClub: arsenal, toClub: ol, fee: 0 }, 'fr-FR')
      ).toBe("Transfert du 1er juillet 2022 d’Arsenal FC vers Olympique Lyonnais, sans indemnité de transfert.");
      expect(describeTransfer({ date: '2010-07-01T00:00:00.000Z', fromClub: null, toClub: ol, fee: null }, 'fr-FR')).toBe(
        'Transfert du 1er juillet 2010 vers Olympique Lyonnais, montant non communiqué.'
      );
    });
  });

  describe('buildTransferSeries', () => {
    it('puts each transfer at its own date, on the line between two valuations', () => {
      const series = buildTransferSeries(
        marketValues,
        [{ date: '2017-07-05T00:00:00.000Z', fromClub: ol, toClub: arsenal, fee: 53000000 }],
        'fr-FR'
      );

      expect(series.label).toBe('Transferts');
      expect(series.showLine).toBeFalse();
      expect(series.times).toEqual([Date.UTC(2017, 6, 5)]);
      // 34 of the 214 days from 1 June 2017 to 1 January 2018: 40M + 10M x 34 / 214
      expect(series.data).toEqual([41588785]);
      expect(series.pointLabels?.[0]).toContain('Transfert du 5 juillet 2017');
    });

    it('takes the valuation itself for a transfer on a valuation date', () => {
      const series = buildTransferSeries(
        marketValues,
        [{ date: '2016-06-01T00:00:00.000Z', fromClub: null, toClub: ol, fee: null }],
        'fr-FR'
      );

      expect(series.data).toEqual([10000000]);
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

      expect(series.data).toEqual([]);
      expect(series.times).toEqual([]);
      expect(buildTransferSeries([], [{ date: '2010-07-01', fromClub: null, toClub: ol, fee: null }], 'fr-FR').data).toEqual([]);
    });

    it('keeps transfers a few days apart as separate markers, in date order', () => {
      const series = buildTransferSeries(
        marketValues,
        [
          { date: '2016-06-20T00:00:00.000Z', fromClub: ol, toClub: arsenal, fee: 1000000 },
          { date: '2016-06-02T00:00:00.000Z', fromClub: null, toClub: ol, fee: null }
        ],
        'fr-FR'
      );

      expect(series.times).toEqual([Date.UTC(2016, 5, 2), Date.UTC(2016, 5, 20)]);
    });

    it('joins transfers on the same day into one marker', () => {
      const series = buildTransferSeries(
        marketValues,
        [
          { date: '2016-06-20T00:00:00.000Z', fromClub: null, toClub: ol, fee: null },
          { date: '2016-06-20T00:00:00.000Z', fromClub: ol, toClub: arsenal, fee: 1000000 }
        ],
        'fr-FR'
      );

      expect(series.data.length).toBe(1);
      expect(series.pointLabels?.[0]).toBe(
        'Transfert du 20 juin 2016 vers Olympique Lyonnais, montant non communiqué. ' +
          describeTransfer({ date: '2016-06-20T00:00:00.000Z', fromClub: ol, toClub: arsenal, fee: 1000000 }, 'fr-FR')
      );
    });
  });
});
